const PushSubscriptionModel =
    require("../models/pushSubscriptionModel");

const PushNotificationSettingsModel =
    require("../models/pushNotificationSettingsModel");


// =====================================================
// GET NOTIFICATION SETTINGS
// =====================================================

const getNotificationSettings = async (req, res) => {

    try {

        const memberId = req.user.member_id;

        let settings =
            await PushNotificationSettingsModel.getSettings(
                memberId
            );

        // Create default settings if user doesn't have them
        if (!settings || settings.length === 0) {

            await PushNotificationSettingsModel
                .createDefaultSettings(memberId);

            settings =
                await PushNotificationSettingsModel
                    .getSettings(memberId);
        }

        return res.status(200).json({

            success: true,

            data: settings[0]

        });

    } catch (error) {

        console.error(
            "Get notification settings error:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Unable to get notification settings"

        });
    }
};


// =====================================================
// UPDATE NOTIFICATION SETTINGS
// =====================================================
//
// MASTER:
//
// {
//     "type": "all",
//     "enabled": 1
// }
//
// INDIVIDUAL:
//
// {
//     "type": "wallet_updates",
//     "enabled": 1
// }
//
// Optional browser push subscription:
//
// "push_subscription": {
//     "endpoint": "...",
//     "keys": {
//         "p256dh": "...",
//         "auth": "..."
//     }
// }
//
// =====================================================

const updateNotificationSettings = async (req, res) => {

    try {

        const memberId = req.user.member_id;

        const {
            type,
            enabled,
            push_subscription
        } = req.body;


        // =====================================================
        // VALIDATE TYPE
        // =====================================================

        const allowedTypes = [

            "all",

            "new_survey_available",

            "survey_reminders",

            "reward_received",

            "wallet_updates",

            "referral_notifications"

        ];

        if (!type || !allowedTypes.includes(type)) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid notification type"

            });
        }


        // =====================================================
        // VALIDATE ENABLED
        // =====================================================

        if (
            enabled !== 0 &&
            enabled !== 1 &&
            enabled !== "0" &&
            enabled !== "1"
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "enabled must be 0 or 1"

            });
        }

        const enableValue =
            Number(enabled) === 1 ? 1 : 0;


        // =====================================================
        // GET EXISTING SETTINGS
        // =====================================================

        let existing =
            await PushNotificationSettingsModel.getSettings(
                memberId
            );


        // =====================================================
        // CREATE DEFAULT SETTINGS
        // =====================================================

        if (!existing || existing.length === 0) {

            await PushNotificationSettingsModel
                .createDefaultSettings(memberId);

            existing =
                await PushNotificationSettingsModel.getSettings(
                    memberId
                );
        }


        // =====================================================
        // CURRENT SETTINGS
        // =====================================================

        const current = existing[0];


        const settings = {

            all_notifications:
                Number(current.all_notifications),

            new_survey_available:
                Number(current.new_survey_available),

            survey_reminders:
                Number(current.survey_reminders),

            reward_received:
                Number(current.reward_received),

            wallet_updates:
                Number(current.wallet_updates),

            referral_notifications:
                Number(current.referral_notifications)

        };


        // =====================================================
        // MASTER TOGGLE
        // =====================================================

        if (type === "all") {

            settings.all_notifications =
                enableValue;

            settings.new_survey_available =
                enableValue;

            settings.survey_reminders =
                enableValue;

            settings.reward_received =
                enableValue;

            settings.wallet_updates =
                enableValue;

            settings.referral_notifications =
                enableValue;

        }


        // =====================================================
        // INDIVIDUAL TOGGLE
        // =====================================================

        else {

            settings[type] =
                enableValue;


            // -------------------------------------------------
            // If all individual notifications are ON,
            // automatically turn ON master.
            // -------------------------------------------------

            const allIndividualEnabled =

                settings.new_survey_available === 1 &&

                settings.survey_reminders === 1 &&

                settings.reward_received === 1 &&

                settings.wallet_updates === 1 &&

                settings.referral_notifications === 1;


            if (allIndividualEnabled) {

                settings.all_notifications = 1;

            } else {

                settings.all_notifications = 0;

            }

        }


        // =====================================================
        // SAVE SETTINGS
        // =====================================================

        await PushNotificationSettingsModel.updateSettings(

            memberId,

            settings

        );


        // =====================================================
        // SAVE BROWSER PUSH INFORMATION
        // =====================================================

        if (push_subscription) {

            if (
                !push_subscription.endpoint ||
                !push_subscription.keys ||
                !push_subscription.keys.p256dh ||
                !push_subscription.keys.auth
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid push subscription data"

                });

            }


            await PushSubscriptionModel.saveSubscription(

                memberId,

                push_subscription.endpoint,

                push_subscription.keys.p256dh,

                push_subscription.keys.auth,

                req.headers["user-agent"] || null

            );

        }


        // =====================================================
        // RESPONSE
        // =====================================================

        return res.status(200).json({

            success: true,

            message:
                "Notification settings updated successfully",

            data: settings

        });

    } catch (error) {

        console.error(
            "Update notification settings error:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Unable to update notification settings"

        });
    }
};


// =====================================================
// EXPORT
// =====================================================

module.exports = {

    getNotificationSettings,

    updateNotificationSettings

};