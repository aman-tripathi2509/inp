const webpush = require("web-push");
const db = require("../config/db");

webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

const sendPushNotification = async (
    memberId,
    title,
    body,
    url = "/"
) => {
    try {
        const [subscriptions] = await db.query(
            `
            SELECT
                id,
                endpoint,
                p256dh,
                auth
            FROM user_push_notifications
            WHERE member_id = ?
            `,
            [memberId]
        );

        if (!subscriptions || subscriptions.length === 0) {
            return {
                success: false,
                message: "No push subscription found for this user"
            };
        }

        const results = [];

        for (const subscription of subscriptions) {

            const pushSubscription = {
                endpoint: subscription.endpoint,
                keys: {
                    p256dh: subscription.p256dh,
                    auth: subscription.auth
                }
            };

            try {

                await webpush.sendNotification(
                    pushSubscription,
                    JSON.stringify({
                        title,
                        body,
                        url
                    })
                );

                results.push({
                    subscription_id: subscription.id,
                    success: true
                });

            } catch (error) {

                console.error(
                    "Push notification error:",
                    error.message
                );

                // Subscription no longer exists
                if (
                    error.statusCode === 404 ||
                    error.statusCode === 410
                ) {
                    await db.query(
                        `
                        DELETE FROM user_push_notifications
                        WHERE id = ?
                        `,
                        [subscription.id]
                    );
                }

                results.push({
                    subscription_id: subscription.id,
                    success: false,
                    error: error.message
                });
            }
        }

        return {
            success: true,
            results
        };

    } catch (error) {

        console.error(
            "sendPushNotification error:",
            error
        );

        return {
            success: false,
            message: error.message
        };
    }
};


const sendNewSurveyAvailableNotifications = async (surveyId) => {

    try {

        // -------------------------------------------------
        // Get survey details
        // -------------------------------------------------

        const [[survey]] = await db.query(
            `
            SELECT
                id,
                member_id,
                survey_title,
                min_age,
                max_age,
                gender,
                country,
                state,
                sector,
                industry,
                status
            FROM inp_survey
            WHERE id = ?
            LIMIT 1
            `,
            [surveyId]
        );


        if (!survey) {
            throw new Error("Survey not found");
        }


        // -------------------------------------------------
        // Only notify when survey is active
        // -------------------------------------------------

        if (Number(survey.status) !== 1) {
            return {
                success: false,
                message: "Survey is not active"
            };
        }


        // -------------------------------------------------
        // Find matching users
        // -------------------------------------------------

        const [users] = await db.query(
            `
            SELECT DISTINCT
                u.member_id
            FROM user u

            LEFT JOIN user_profiles up
                ON up.u_id = u.id

            INNER JOIN user_push_notification_settings ns
                ON ns.member_id = u.member_id

            WHERE

                -- Don't notify survey creator
                u.member_id != ?

                -- New Survey notification enabled
                AND ns.new_survey_available = 1

                -- Age
                AND (
                    ? IS NULL
                    OR ? IS NULL
                    OR COALESCE(
                        TIMESTAMPDIFF(
                            YEAR,
                            u.dob,
                            CURDATE()
                        ),
                        u.age_entered
                    ) BETWEEN ? AND ?
                )

                -- Gender
                AND (
                    ? IS NULL
                    OR ? = ''
                    OR ? = '0'
                    OR FIND_IN_SET(
                        u.gender,
                        ?
                    )
                )

                -- Country
                AND (
                    ? IS NULL
                    OR ? = ''
                    OR FIND_IN_SET(
                        u.country,
                        ?
                    )
                )

                -- State
                AND (
                    ? IS NULL
                    OR ? = ''
                    OR FIND_IN_SET(
                        u.state,
                        ?
                    )
                )

                -- Sector
                AND (
                    ? IS NULL
                    OR ? = ''
                    OR FIND_IN_SET(
                        up.sector,
                        ?
                    )
                )

                -- Industry
                AND (
                    ? IS NULL
                    OR ? = ''
                    OR FIND_IN_SET(
                        up.industry,
                        ?
                    )
                )
            `,
            [

                // creator
                survey.member_id,

                // age
                survey.min_age,
                survey.max_age,
                survey.min_age,
                survey.max_age,

                // gender
                survey.gender,
                survey.gender,
                survey.gender,
                survey.gender,

                // country
                survey.country,
                survey.country,
                survey.country,

                // state
                survey.state,
                survey.state,
                survey.state,

                // sector
                survey.sector,
                survey.sector,
                survey.sector,

                // industry
                survey.industry,
                survey.industry,
                survey.industry
            ]
        );


        console.log(
            `Found ${users.length} matching users for survey ${surveyId}`
        );


        // -------------------------------------------------
        // Send notification
        // -------------------------------------------------

        const results = [];


        for (const user of users) {

            const result =
                await sendPushNotification(

                    user.member_id,

                    "New Survey Available",

                    `${survey.survey_title} is now available for you.`,

                    `/survey-for-me?survey_id=${survey.id}`

                );


            results.push({

                member_id:
                    user.member_id,

                ...result

            });

        }


        return {

            success: true,

            survey_id: surveyId,

            users_found: users.length,

            results

        };

    } catch (error) {

        console.error(
            "sendNewSurveyAvailableNotifications error:",
            error
        );

        throw error;
    }
};


module.exports = {
    sendPushNotification,
    sendNewSurveyAvailableNotifications
};