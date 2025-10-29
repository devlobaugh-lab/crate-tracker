import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  getDocs,
  collection,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase.ts';
import { AuthorizedUser, UserInvitation } from '../types';
import logger from './logger';

// Note: Email sending moved to a future external service or backend API
// For now, we'll keep the Firebase Functions for user management
// and return email content for manual sending or external service integration

/**
 * Authorization utility functions
 * All operations performed client-side for free tier compatibility
 */

export class AuthorizationService {
  /**
   * Check if the current user is authorized to access the app
   */
  static async checkUserAuthorization(
    userEmail: string
  ): Promise<{ authorized: boolean; role?: 'admin' | 'normal' }> {
    logger.log(`🔍 Checking authorization for: ${userEmail}`);
    logger.log(`🔍 Normalized email: ${userEmail.toLowerCase()}`);

    try {
      const docRef = doc(db, 'authorizedUsers', userEmail.toLowerCase());
      logger.log(`🔍 Looking for document: authorizedUsers/${userEmail.toLowerCase()}`);

      const docSnap = await getDoc(docRef);

      logger.log(`🔍 Document exists: ${docSnap.exists()}`);

      if (docSnap.exists()) {
        const data = docSnap.data() as AuthorizedUser;
        logger.log(`🔍 Document data:`, data);
        logger.log(`🔍 Status check: ${data.status} === 'active'? ${data.status === 'active'}`);

        if (data.status === 'active') {
          logger.log(`✅ User ${userEmail} is authorized as ${data.role}`);
          return { authorized: true, role: data.role };
        } else {
          logger.log(`⚠️ User ${userEmail} found but status is '${data.status}', not 'active'`);
          return { authorized: false };
        }
      } else {
        logger.log(`❌ User ${userEmail} document not found in authorizedUsers collection`);
        logger.log(`💡 Make sure the email is lowercase in Firestore: ${userEmail.toLowerCase()}`);
        return { authorized: false };
      }

      logger.log(`❌ Unexpected authorization failure for ${userEmail}`);
      return { authorized: false };
    } catch (error) {
      logger.error(`❌ Error checking authorization for ${userEmail}:`, error);
      logger.error(`❌ Error details:`, (error as Error).message);
      return { authorized: false };
    }
  }

  /**
   * Check if a user exists in the system (admin helper - doesn't check status)
   */
  static async checkUserExists(userEmail: string): Promise<boolean> {
    try {
      const docRef = doc(db, 'authorizedUsers', userEmail.toLowerCase());
      const docSnap = await getDoc(docRef);
      return docSnap.exists();
    } catch (error) {
      logger.error(`❌ Error checking if user exists: ${userEmail}:`, error);
      return false;
    }
  }

  /**
   * Invite and authorize a new Gmail user (admin only)
   * NOTE: Since Firebase Functions have CORS issues in staging, this is now client-side
   */
  static async authorizeUser(
    invitation: UserInvitation,
    adminEmail: string
  ): Promise<{ success: boolean; message: string; user?: AuthorizedUser; emailContent?: any }> {
    try {
      // Validate Gmail format client-side
      if (!invitation.email.toLowerCase().endsWith('@gmail.com')) {
        return { success: false, message: 'Only Gmail addresses are allowed.' };
      }

      // Check admin permission
      const adminCheck = await this.checkUserAuthorization(adminEmail);
      if (!adminCheck.authorized || adminCheck.role !== 'admin') {
        return { success: false, message: 'Only administrators can invite new users.' };
      }

      // Check if user already exists
      const userExists = await this.checkUserAuthorization(invitation.email.toLowerCase());
      if (userExists.authorized) {
        return { success: false, message: 'This email address is already authorized.' };
      }

      // Create user record in Firestore (client-side authorization)
      const newUser: AuthorizedUser = {
        id: invitation.email.toLowerCase(),
        email: invitation.email.toLowerCase(),
        role: invitation.role,
        status: 'active',
        invitedBy: adminEmail.toLowerCase(),
        invitedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = doc(db, 'authorizedUsers', invitation.email.toLowerCase());
      await setDoc(docRef, newUser);

      // Generate email content (same as previewInvitation)
      // const roleText = invitation.role === 'admin' ? 'Administrator' : 'Regular User';
      const emailSubject = "You're invited to join Crate Tracker!";
      const emailHtml = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>Welcome to Crate Tracker!</h2>
  <p>You've been invited to join Crate Tracker.</p>
  <p>Crate Tracker is a tool for tracking your game progress and patterns.</p>
  <p>To get started:</p>
  <ol>
    <li>Visit <a href="https://crate-tracker-38b6e.web.app/">https://crate-tracker-38b6e.web.app/</a></li>
    <li>Sign in with your Gmail account</li>
    <li>Start tracking your crates!</li>
  </ol>
  <hr>
  <p style="font-size: 12px; color: #666;">
    This invitation was sent automatically. Please do not reply to this message.
  </p>
</div>`;

      const emailText = `Welcome to Crate Tracker!

Visit: https://crate-tracker-38b6e.web.app/
Sign in with your Gmail account

---
This invitation was sent automatically.`;

      logger.log(`✅ User authorized successfully: ${invitation.email}`);

      return {
        success: true,
        message: 'User authorized successfully. Please send the invitation email manually.',
        user: newUser,
        emailContent: {
          to: invitation.email,
          subject: emailSubject,
          html: emailHtml,
          text: emailText,
        },
      };
    } catch (error: any) {
      logger.error('Error authorizing user:', error);
      return {
        success: false,
        message: 'Failed to authorize user. Please try again.',
      };
    }
  }

  /**
   * Preview email invitation content without sending
   */
  static async previewInvitation(
    invitation: UserInvitation,
    adminEmail: string
  ): Promise<{ success: boolean; message: string; emailContent?: any }> {
    try {
      // Validate Gmail format client-side
      if (!invitation.email.toLowerCase().endsWith('@gmail.com')) {
        return { success: false, message: 'Only Gmail addresses are allowed.' };
      }

      // Basic admin check
      const adminCheck = await this.checkUserAuthorization(adminEmail);
      if (!adminCheck.authorized || adminCheck.role !== 'admin') {
        return { success: false, message: 'Only administrators can preview invitations.' };
      }

      // Generate email content client-side (no CORS issues)
      // const roleText = invitation.role === 'admin' ? 'Administrator' : 'Regular User';
      const emailSubject = "You're invited to join Crate Tracker!";
      const emailHtml = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>Welcome to Crate Tracker!</h2>
  <p>You've been invited to join Crate Tracker.</p>
  <p>Crate Tracker is a tool for tracking your game progress and patterns.</p>
  <p>To get started:</p>
  <ol>
    <li>Visit <a href="https://crate-tracker-38b6e.web.app/">https://crate-tracker-38b6e.web.app/</a></li>
    <li>Sign in with your Gmail account</li>
    <li>Start tracking your crates!</li>
  </ol>
  <hr>
  <p style="font-size: 12px; color: #666;">
    This invitation was sent automatically. Please do not reply to this message.
  </p>
</div>`;

      const emailText = `Welcome to Crate Tracker!

Visit: https://crate-tracker-38b6e.web.app
Sign in with your Gmail account

---
This invitation was sent automatically.`;

      return {
        success: true,
        message: 'Email preview generated successfully.',
        emailContent: {
          to: invitation.email,
          subject: emailSubject,
          html: emailHtml,
          text: emailText,
        },
      };
    } catch (error: any) {
      logger.error('Error previewing invitation:', error);
      return {
        success: false,
        message: 'Failed to preview invitation.',
      };
    }
  }

  /**
   * List all authorized users (admin only)
   */
  static async listAuthorizedUsers(
    adminEmail: string
  ): Promise<{ success: boolean; users?: AuthorizedUser[]; message?: string }> {
    try {
      // Check if admin
      const adminCheck = await this.checkUserAuthorization(adminEmail);
      if (!adminCheck.authorized || adminCheck.role !== 'admin') {
        return { success: false, message: 'Only administrators can list users.' };
      }

      // Get all authorized users
      const querySnapshot = await getDocs(collection(db, 'authorizedUsers'));
      const users: AuthorizedUser[] = [];

      querySnapshot.forEach(doc => {
        users.push({ id: doc.id, ...doc.data() } as AuthorizedUser);
      });

      logger.log(`📋 Listed ${users.length} authorized users`);
      return { success: true, users };
    } catch (error) {
      logger.error('Error listing users:', error);
      return {
        success: false,
        message: 'Failed to list users. Please try again.',
      };
    }
  }

  /**
   * Validate Gmail address format
   */
  static isValidGmailAddress(email: string): boolean {
    const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
    return gmailRegex.test(email);
  }

  /**
   * Update user role (admin only)
   */
  static async updateUserRole(
    targetEmail: string,
    newRole: 'admin' | 'normal',
    adminEmail: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Check if admin
      const adminCheck = await this.checkUserAuthorization(adminEmail);
      if (!adminCheck.authorized || adminCheck.role !== 'admin') {
        return { success: false, message: 'Only administrators can update user roles.' };
      }

      // Validate role
      if (!['admin', 'normal'].includes(newRole)) {
        return { success: false, message: 'Invalid role specified.' };
      }

      // Check if target user exists
      const userExists = await this.checkUserExists(targetEmail);
      if (!userExists) {
        return { success: false, message: 'Target user not found.' };
      }

      // Update the user role
      const docRef = doc(db, 'authorizedUsers', targetEmail.toLowerCase());
      await setDoc(docRef, { role: newRole, updatedAt: serverTimestamp() }, { merge: true });

      logger.log(`✅ User role updated: ${targetEmail} → ${newRole}`);
      return {
        success: true,
        message: `User role updated to ${newRole}.`,
      };
    } catch (error) {
      logger.error('Error updating user role:', error);
      return {
        success: false,
        message: 'Failed to update user role. Please try again.',
      };
    }
  }

  /**
   * Deactivate or activate user (admin only)
   */
  static async toggleUserStatus(
    targetEmail: string,
    newStatus: 'active' | 'inactive',
    adminEmail: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Validate status
      if (!['active', 'inactive'].includes(newStatus)) {
        return { success: false, message: 'Invalid status specified.' };
      }

      // Check if admin
      const adminCheck = await this.checkUserAuthorization(adminEmail);
      if (!adminCheck.authorized || adminCheck.role !== 'admin') {
        return { success: false, message: 'Only administrators can change user status.' };
      }

      // Check if target user exists
      const userExists = await this.checkUserExists(targetEmail);
      if (!userExists) {
        return { success: false, message: 'Target user not found.' };
      }

      // Update the user status
      const docRef = doc(db, 'authorizedUsers', targetEmail.toLowerCase());
      await setDoc(docRef, { status: newStatus, updatedAt: serverTimestamp() }, { merge: true });

      const action = newStatus === 'active' ? 'activated' : 'deactivated';
      logger.log(`✅ User ${action}: ${targetEmail}`);
      return {
        success: true,
        message: `User has been ${action}.`,
      };
    } catch (error) {
      logger.error('Error changing user status:', error);
      return {
        success: false,
        message: 'Failed to change user status. Please try again.',
      };
    }
  }

  /**
   * Delete user (admin only - hard delete)
   */
  static async deleteUser(
    targetEmail: string,
    adminEmail: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Check if admin
      const adminCheck = await this.checkUserAuthorization(adminEmail);
      if (!adminCheck.authorized || adminCheck.role !== 'admin') {
        return { success: false, message: 'Only administrators can delete users.' };
      }

      // Check if target user exists
      const userExists = await this.checkUserExists(targetEmail);
      if (!userExists) {
        return { success: false, message: 'Target user not found.' };
      }

      // Delete the user document
      const docRef = doc(db, 'authorizedUsers', targetEmail.toLowerCase());
      await deleteDoc(docRef);

      logger.log(`✅ User deleted: ${targetEmail}`);
      return {
        success: true,
        message: 'User has been removed from the system.',
      };
    } catch (error) {
      logger.error('Error deleting user:', error);
      return {
        success: false,
        message: 'Failed to delete user. Please try again.',
      };
    }
  }

  /**
   * Normalize email to lowercase
   */
  static normalizeEmail(email: string | null | undefined): string {
    if (!email) return '';
    return email.toLowerCase().trim();
  }
}

export default AuthorizationService;
