module.exports = (io) => {

    io.on("connection", (socket) => {

        console.log("User Connected:", socket.id);

        socket.on("joinSurvey", (survey_id) => {

            socket.join(`survey_${survey_id}`);

            console.log(
                `${socket.id} joined survey_${survey_id}`
            );

        });

        socket.on("leaveSurvey", (survey_id) => {

            socket.leave(`survey_${survey_id}`);

            console.log(
                `${socket.id} left survey_${survey_id}`
            );

        });

        socket.on("disconnect", () => {

            console.log(
                "User Disconnected:",
                socket.id
            );

        });

    });

};