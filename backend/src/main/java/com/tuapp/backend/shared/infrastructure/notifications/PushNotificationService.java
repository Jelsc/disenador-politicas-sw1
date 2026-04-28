package com.tuapp.backend.shared.infrastructure.notifications;

import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.Notification;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class PushNotificationService {
    private static final Logger log = LoggerFactory.getLogger(PushNotificationService.class);

    /**
     * Sends a push notification to a specific device token.
     *
     * @param token The FCM device token.
     * @param title The notification title.
     * @param body  The notification body.
     * @param data  Additional data payload (optional).
     */
    public void sendPushNotificationToToken(String token, String title, String body, Map<String, String> data) {
        if (token == null || token.isBlank()) {
            log.warn("Intento de envio de notificacion a token nulo/vacio. Ignorando...");
            return;
        }

        try {
            Notification notification = Notification.builder()
                    .setTitle(title)
                    .setBody(body)
                    .build();

            Message.Builder messageBuilder = Message.builder()
                    .setToken(token)
                    .setNotification(notification);

            if (data != null && !data.isEmpty()) {
                messageBuilder.putAllData(data);
            }

            Message message = messageBuilder.build();
            String response = FirebaseMessaging.getInstance().send(message);
            log.info("Notificacion push enviada con exito. Response ID: {}", response);

        } catch (FirebaseMessagingException e) {
            log.error("Error al enviar notificacion push a token {}", token, e);
        } catch (Exception e) {
            log.error("Error inesperado al enviar notificacion push", e);
        }
    }
}