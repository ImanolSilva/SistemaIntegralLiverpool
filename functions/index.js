const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// Función para obtener un usuario por email
exports.getUserByEmail = functions.https.onCall(async (data, context) => {
  // Verificar que el usuario que llama esté autenticado
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'El usuario debe estar autenticado.');
  }

  // Verificar que el usuario que llama sea admin
  const requester = await admin.firestore().collection('admins').doc(context.auth.uid).get();
  if (!requester.exists) {
    throw new functions.https.HttpsError('permission-denied', 'No tienes permisos para realizar esta acción.');
  }

  const email = data.email;
  if (!email) {
    throw new functions.https.HttpsError('invalid-argument', 'Email no proporcionado.');
  }

  try {
    const userRecord = await admin.auth().getUserByEmail(email);
    return { uid: userRecord.uid, email: userRecord.email };
  } catch (error) {
    console.error('Error al obtener el usuario por email:', error);
    throw new functions.https.HttpsError('not-found', 'Usuario no encontrado.');
  }
});
