const PROTOCOL_VERSION = 1;
const COMPRESSION = "gzip";
const ENCODING = "base64";
const KEY_AGREEMENT = "ECDH-P256";
const KEY_DERIVATION = "HKDF-SHA256";
const CIPHER = "AES-256-GCM";
const HKDF_INFO = "vupadhi-analytics-dashboard-project-1";
const SERVER_PUBLIC_KEY_LENGTH_BYTES = 2;
const SALT_LENGTH_BYTES = 32;
const IV_LENGTH_BYTES = 12;

let clientKeyPair = null;
let clientPublicKeyBase64 = null;

async function getClientKeyPair() {
    if (clientKeyPair) {
        return clientKeyPair;
    }

    const keyPair =
        await window.crypto.subtle.generateKey(
            {name: "ECDH",namedCurve: "P-256",},
            false,
            ["deriveBits",]
        );

    clientKeyPair = keyPair;

    return keyPair;
}

async function exportClientPublicKey(
    publicKey
) {
    const encodedPublicKey =
        await window.crypto.subtle.exportKey(
            "spki",
            publicKey
        );

    return bytesToBase64(
        new Uint8Array(
            encodedPublicKey
        )
    );
}

async function getClientPublicKey() {
    if (clientPublicKeyBase64) {
        return clientPublicKeyBase64;
    }

    const keyPair =
        await getClientKeyPair();

    clientPublicKeyBase64 =
        await exportClientPublicKey(
            keyPair.publicKey
        );

    return clientPublicKeyBase64;
}

function base64ToBytes(base64Value) {
    const binaryString =
        window.atob(base64Value);

    const bytes =
        new Uint8Array(
            binaryString.length
        );

    for (
        let index = 0;
        index < binaryString.length;
        index++
    ) {
        bytes[index] =
            binaryString.charCodeAt(index);
    }

    return bytes;
}

function bytesToBase64(bytes) {
    let binaryString = "";

    const chunkSize = 0x8000;

    for (
        let index = 0;
        index < bytes.length;
        index += chunkSize
    ) {
        const chunk =
            bytes.subarray(
                index,
                index + chunkSize
            );

        binaryString += String.fromCharCode(
            ...chunk
        );
    }

    return window.btoa(
        binaryString
    );
}

function decodeEnvelope(
    encryptedData
) {
    const envelope =
        base64ToBytes(
            encryptedData
        );

    const minimumLength =
        SERVER_PUBLIC_KEY_LENGTH_BYTES
        + SALT_LENGTH_BYTES
        + IV_LENGTH_BYTES;

    if (
        envelope.length <
        minimumLength
    ) {
        throw new Error(
            "Encrypted report data is too short."
        );
    }

    const serverPublicKeyLength =
        (envelope[0] << 8)
        | envelope[1];

    let offset =
        SERVER_PUBLIC_KEY_LENGTH_BYTES;

    const minimumEnvelopeLength =
        offset
        + serverPublicKeyLength
        + SALT_LENGTH_BYTES
        + IV_LENGTH_BYTES;

    if (
        serverPublicKeyLength <= 0
        || envelope.length <
            minimumEnvelopeLength
    ) {
        throw new Error(
            "Encrypted report data is invalid."
        );
    }

    const serverPublicKey =
        envelope.slice(
            offset,
            offset + serverPublicKeyLength
        );

    offset +=
        serverPublicKeyLength;

    const salt =
        envelope.slice(
            offset,
            offset + SALT_LENGTH_BYTES
        );

    offset += SALT_LENGTH_BYTES;

    const iv =
        envelope.slice(
            offset,
            offset + IV_LENGTH_BYTES
        );

    offset += IV_LENGTH_BYTES;

    const ciphertext =
        envelope.slice(
            offset
        );

    if (ciphertext.length === 0) {
        throw new Error(
            "Encrypted report ciphertext is empty."
        );
    }

    return {
        serverPublicKey,
        salt,
        iv,
        ciphertext,
    };
}

async function deriveAesKey({
    clientPrivateKey,
    serverPublicKey,
    salt,
}) {
    const sharedSecret =
        await window.crypto.subtle.deriveBits(
            {
                name: "ECDH",
                public:
                    serverPublicKey,
            },
            clientPrivateKey,
            256
        );

    const hkdfKey =
        await window.crypto.subtle.importKey(
            "raw",
            sharedSecret,
            {
                name: "HKDF",
            },
            false,
            [
                "deriveKey",
            ]
        );

    return window.crypto.subtle.deriveKey(
        {
            name: "HKDF",
            hash: "SHA-256",
            salt,
            info:
                new TextEncoder().encode(
                    HKDF_INFO
                ),
        },
        hkdfKey,
        {
            name: "AES-GCM",
            length: 256,
        },
        false,
        [
            "decrypt",
        ]
    );
}

function buildAssociatedData(
    reportName,
    generatedAt
) {
    const associatedData =
        `${PROTOCOL_VERSION}`
        + `|${reportName}`
        + `|${generatedAt}`
        + `|${COMPRESSION}`
        + `|${ENCODING}`
        + `|${KEY_AGREEMENT}`
        + `|${KEY_DERIVATION}`
        + `|${CIPHER}`;

    return new TextEncoder().encode(
        associatedData
    );
}

async function decompressGzip(
    compressedPayload
) {
    if (
        typeof DecompressionStream ===
        "undefined"
    ) {
        throw new Error(
            "GZIP decompression is not supported by this browser."
        );
    }

    const compressedStream =
        new Blob([
            compressedPayload,
        ])
            .stream()
            .pipeThrough(
                new DecompressionStream(
                    "gzip"
                )
            );

    const decompressedBuffer =
        await new Response(
            compressedStream
        ).arrayBuffer();

    return new Uint8Array(
        decompressedBuffer
    );
}

async function decryptReportData({
    encryptedData,
    reportName,
    generatedAt,
}) {
    if (
        typeof encryptedData !==
        "string"
        || encryptedData.length === 0
    ) {
        throw new Error(
            "Encrypted report data is missing."
        );
    }

    const keyPair =
        await getClientKeyPair();

    const {
        serverPublicKey,
        salt,
        iv,
        ciphertext,
    } = decodeEnvelope(
        encryptedData
    );

    const importedServerPublicKey =
        await window.crypto.subtle.importKey(
            "spki",
            serverPublicKey,
            {
                name: "ECDH",
                namedCurve: "P-256",
            },
            false,
            []
        );

    const aesKey =
        await deriveAesKey({
            clientPrivateKey:
                keyPair.privateKey,
            serverPublicKey:
                importedServerPublicKey,
            salt,
        });

    const compressedPayload =
        await window.crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv,
                additionalData:
                    buildAssociatedData(
                        reportName,
                        generatedAt
                    ),
                tagLength: 128,
            },
            aesKey,
            ciphertext
        );

    const jsonPayload =
        await decompressGzip(
            new Uint8Array(
                compressedPayload
            )
        );

    const jsonText =
        new TextDecoder().decode(
            jsonPayload
        );

    return JSON.parse(
        jsonText
    );
}

export {
    getClientPublicKey,
    decryptReportData,
};