import { Injectable } from '@nestjs/common';
import fetch from 'node-fetch';

@Injectable()
export class ExpoService {
  async sendPushNotification(
    token: string,
    title: string,
    body: string,
    data?: any
  ) {
    // Expo expects an array of messages
    const messages = [
      {
        to: token,
        sound: 'default',
        title,
        body,
        data,
      },
    ];

    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
          // Uncomment below if using EAS token
          // Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}`,
        },
        body: JSON.stringify(messages),
      });

      if (!response.ok) {
        // If response is not 200-299
        const errorText = await response.text();
        console.error('Expo push error:', errorText);
        throw new Error(`Expo push failed with status ${response.status}`);
      }

      const resJson = await response.json();
      console.log('Expo push response:', resJson);
      return resJson;
    } catch (err) {
      console.error('Failed to send Expo push notification:', err);
      throw err;
    }
  }
}