import Papa from "papaparse";

function parseCsvFile(file) {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: false,

            complete: (results) => {
                if (results.errors.length > 0) {
                    reject({
                        type: "csv-parse-error",
                        message: "The CSV file could not be parsed.",
                        details: results.errors,
                    });

                    return;
                }

                const fields = results.meta.fields ?? [];

                if (fields.length === 0) {
                    reject({
                        type: "csv-validation-error",
                        message: "The CSV file does not contain any columns.",
                    });

                    return;
                }

                if (results.data.length === 0) {
                    reject({
                        type: "csv-validation-error",
                        message: "The CSV file does not contain any data rows.",
                    });

                    return;
                }

                resolve({
                    fields,
                    rows: results.data,
                });
            },

            error: (error) => {
                reject({
                    type: "csv-read-error",
                    message: "The CSV file could not be read.",
                    details: error,
                });
            },
        });
    });
}

export default parseCsvFile;