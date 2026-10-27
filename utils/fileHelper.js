const BASE_URL = "https://beta.caqsmt.com/freelancer-documents/";

const getFileUrl = (file) => {
    if (!file) return "";

    // already full URL
    if (file.startsWith("http")) return file;

    // 🔥 REMOVE duplicate folder if exists
    file = file.replace(/^freelancer-documents\//, "");

    return `${BASE_URL}${file}`;
};

module.exports = { getFileUrl };