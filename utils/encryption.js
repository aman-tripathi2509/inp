const crypto = require("crypto");

function aesEncrypt(text) {
    if (!text) return null;

    const cipher = crypto.createCipheriv(
        "aes-128-ecb",
        Buffer.from("@!#$%^&*()_+1234"),
        null
    );

    cipher.setAutoPadding(true);

    let encrypted = cipher.update(text, "utf8", "base64");
    encrypted += cipher.final("base64");

    return Buffer.from(encrypted, "base64").toString("hex");
}

function aesDecrypt(cipherHex) {
    if (!cipherHex || !/^[0-9a-fA-F]+$/.test(cipherHex)) return "";

    const encryptedBase64 = Buffer.from(cipherHex, "hex").toString("base64");

    const decipher = crypto.createDecipheriv(
        "aes-128-ecb",
        Buffer.from("@!#$%^&*()_+1234"),
        null
    );

    decipher.setAutoPadding(true);

    let decrypted = decipher.update(encryptedBase64, "base64", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
}

module.exports = { aesEncrypt, aesDecrypt };