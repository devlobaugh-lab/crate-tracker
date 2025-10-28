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

  const { email: inviteeEmail, role } = data;

  if (!inviteeEmail || !role) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing email or role parameter.');
  }

  if (!inviteeEmail.toLowerCase().endsWith('@gmail.com')) {
    throw new functions.https.HttpsError('invalid-argument', 'Only Gmail addresses are allowed.');
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

    // Return email content for manual sending
    const roleText = role === 'admin' ? 'Administrator' : 'Regular User';
    const emailContent = {
      to: inviteeEmail,
      subject: 'You\'re invited to join Crate Tracker!',
      html: '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">' +
            '<h2>Welcome to Crate Tracker!</h2>' +
            '<p>You\'ve been invited by <strong>' + callerData.email + '</strong> to join Crate Tracker.</p>' +
            '<p>Crate Tracker is a tool for tracking your game progress and patterns.</p>' +
            '<p><strong>Your role:</strong> ' + roleText + '</p>' +
            '<p>To get started:</p>' +
            '<ol>' +
            '<li>Visit <a href="https://crate-tracker.web.app">crate-tracker.web.app</a></li>' +
            '<li>Sign in with your Gmail account</li>' +
            '<li>Start tracking your crates!</li>' +
            '</ol>' +
            '<p>This invitation gives you full access to the app.</p>' +
            '</div>',
      text: 'Welcome to Crate Tracker!\n\n' +
            'You\'ve been invited by ' + callerData.email + '.\n\n' +
            'Your role: ' + roleText + '\n\n' +
            'Visit: https://crate-tracker.web.app'
    };

    return {
      success: true,
      message: 'User authorized successfully. Copy and send the email manually.',
      user: { email: inviteeEmail.toLowerCase(), role },
      emailContent
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
