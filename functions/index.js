const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.createUserDocument = functions.auth.user().onCreate((user) => {
  const userData = {
    email: user.email,
    name: user.displayName || 'Nombre Por Defecto',
    area: 'Área Por Defecto', // Puedes personalizar este valor
    role: 'user' // 'admin' o 'user'
  };

  return admin.firestore().collection('users').doc(user.uid).set(userData)
    .then(() => {
      console.log(`Documento creado para el usuario: ${user.uid}`);
    })
    .catch((error) => {
      console.error(`Error al crear documento para el usuario: ${user.uid}`, error);
    });
});
