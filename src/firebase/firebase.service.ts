import { Injectable, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import * as path from 'path';

@Injectable()
export class FirebaseService implements OnModuleInit {

  onModuleInit() {
    const serviceAccount = require(path.join(
      process.cwd(),
      'src/firebase/firebase-key.json',
    ));

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log('🔥 Firebase initialized');
  }

  async sendNotification(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>, 
  ) {

    const message: admin.messaging.Message = {
      token,
      notification: {
        title,
        body,
      },
      data: data, // ✅ no stringify
    };

    try {
      const response = await admin.messaging().send(message);
      return response;
    } catch (error) {
      console.error('FCM error:', error);
    }
  }
}