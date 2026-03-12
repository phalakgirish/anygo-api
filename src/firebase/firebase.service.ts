import * as admin from 'firebase-admin';
import serviceAccount from './firebase-key.json';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});

export class FirebaseService {
  async sendNotification(
    fcmToken: string,
    title: string,
    body: string,
    data: Record<string, any> = {}
  ) {
    try {
      await admin.messaging().send({
        token: fcmToken,
        notification: { title, body },
        data,
      });
      console.log(`Notification sent to ${fcmToken}`);
    } catch (err) {
      console.error('Error sending notification', err);
    }
  }
}