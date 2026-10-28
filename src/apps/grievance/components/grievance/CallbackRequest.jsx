import React, { useState } from "react";

function CallbackRequest({
    ticketData,
    onBack
}) {

    const config = window.GRIEVANCE_CONFIG || {};

    const [phone, setPhone] = useState(
        config.mobileNumber || ""
    );

    const [callBackType, setCallBackType] = useState("");

    const [loading, setLoading] = useState(false);

    const [error, setError] = useState("");

    const handleSubmit = async () => {

        if (!phone || !phone.trim()) {

            setError(
                "Please enter Mobile Number."
            );

            return;
        }

        if (!callBackType) {

            setError(
                "Please select Callback or WhatsApp."
            );

            return;
        }

        setError("");
        setLoading(true);

        try {

            const userID =
                config.userID || "";

            const request = {

                ticketId:
                    ticketData?.ticketId,

                mobileNumber:
                    phone,

                callBackType:
                    parseInt(callBackType),

                callBackCreateddBy:
                    userID,

                callBackCreatedBy:
                    userID
            };

            console.log(
                "Callback Request:",
                request
            );


            /*
             * API:
             *
             * POST /callback/saveCallRequest
             *
             * API call will be connected here.
             */


            alert(
                "Callback request submitted successfully."
            );

        } catch (error) {

            console.error(
                "Callback request error:",
                error
            );

            setError(
                "Unable to submit request. Please try again."
            );

        } finally {

            setLoading(false);
        }
    };


    return (

        <div className="grievance-page">

            <div className="grievance-container">

                <h2 className="grievance-title">
                    Callback Request
                </h2>

                <p className="grievance-subtitle">
                    Request a callback or WhatsApp support
                </p>


                <div className="callback-container">

                    {/* Mobile */}

                    <div className="form-group">

                        <label>
                            Mobile Number
                        </label>

                        <input
                            type="text"
                            className="form-control"
                            value={phone}
                            onChange={(e) =>
                                setPhone(e.target.value)
                            }
                            maxLength="10"
                        />

                    </div>


                    {/* Request Type */}

                    <div className="form-group">

                        <label>
                            Request Type
                        </label>

                        <select
                            className="form-control"
                            value={callBackType}
                            onChange={(e) =>
                                setCallBackType(e.target.value)
                            }
                        >

                            <option value="">
                                Select
                            </option>

                            <option value="1">
                                Callback
                            </option>

                            <option value="2">
                                WhatsApp
                            </option>

                        </select>

                    </div>


                    {error && (

                        <div className="error-message">
                            {error}
                        </div>

                    )}


                    <div className="ticket-confirmation-buttons">

                        <button
                            type="button"
                            className="Button"
                            onClick={onBack}
                        >
                            Back
                        </button>

                        <button
                            type="button"
                            className="Button2"
                            onClick={handleSubmit}
                            disabled={loading}
                        >
                            {loading
                                ? "Submitting..."
                                : "Submit"}
                        </button>

                    </div>

                </div>

            </div>

        </div>
    );
}

export default CallbackRequest;