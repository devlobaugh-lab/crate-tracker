const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
admin.initializeApp();

exports.sendInvite = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
  }

  const callerEmail = context.auth.token.email;
  if (!callerEmail) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
  }

  const { email: inviteeEmail, role, previewOnly = false } = data;

  if (!inviteeEmail || !role) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing email or role parameter.');
  }

  // Validate email format (accepts any valid email address)
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i;
  if (!emailRegex.test(inviteeEmail)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid email address format.');
  }

  if (role !== 'admin' && role !== 'normal') {
    throw new functions.https.HttpsError('invalid-argument', 'Role must be either "admin" or "normal".');
  }

  try {
    // Check admin permission
    const callerDoc = await admin.firestore().collection('authorizedUsers').doc(callerEmail.toLowerCase()).get();

    if (!callerDoc.exists) {
      throw new functions.https.HttpsError('permission-denied', 'Only authorized users can send invitations.');
    }

    const callerData = callerDoc.data();
    if (callerData.role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Only admins can send invitations.');
    }

    // Check if user already exists
    const inviteeDoc = await admin.firestore().collection('authorizedUsers').doc(inviteeEmail.toLowerCase()).get();

    if (inviteeDoc.exists) {
      throw new functions.https.HttpsError('already-exists', 'This email address is already authorized.');
    }

    // Generate email content
    const roleText = role === 'admin' ? 'Administrator' : 'Regular User';
    const emailSubject = 'You\'re invited to join Crate Tracker!';
    const emailHtml = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>Welcome to Crate Tracker!</h2>
  <p>You're invited to join Crate Tracker.</p>
  <p>Crate Tracker is a tool for tracking your F1 Crate pattern.</p>
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

    // If preview only, return email content without creating user
    if (previewOnly) {
      return {
        success: true,
        message: 'Email preview generated successfully.',
        emailContent: {
          to: inviteeEmail,
          subject: emailSubject,
          html: emailHtml,
          text: emailText,
        }
      };
    }

    // Create user record
    const now = admin.firestore.Timestamp.now();
    await admin.firestore().collection('authorizedUsers').doc(inviteeEmail.toLowerCase()).set({
      email: inviteeEmail.toLowerCase(),
      role,
      status: 'active',
      invitedBy: callerEmail.toLowerCase(),
      invitedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return {
      success: true,
      message: 'User authorized successfully. Please send the invitation email manually or integrate with your SMTP service.',
      user: {
        email: inviteeEmail.toLowerCase(),
        role
      },
      emailContent: {
        to: inviteeEmail,
        subject: emailSubject,
        html: emailHtml,
        text: emailText,
      }
    };

  } catch (error) {
    console.error('Error sending invitation:', error);
    if (error.code) throw error;
    throw new functions.https.HttpsError('internal', 'Failed to send invitation.');
  }
});

exports.listUsers = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
  }

  const callerEmail = context.auth.token.email;
  if (!callerEmail) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
  }

  try {
    // Check admin permission
    const callerDoc = await admin.firestore().collection('authorizedUsers').doc(callerEmail.toLowerCase()).get();

    if (!callerDoc.exists) {
      throw new functions.https.HttpsError('permission-denied', 'Only authorized users can list users.');
    }

    const callerData = callerDoc.data();
    if (callerData.role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Only admins can list users.');
    }

    const usersSnapshot = await admin.firestore().collection('authorizedUsers').get();
    const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return { success: true, users, totalCount: users.length };

  } catch (error) {
    console.error('Error listing users:', error);
    if (error.code) throw error;
    throw new functions.https.HttpsError('internal', 'Failed to list users.');
  }
});
