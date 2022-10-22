import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useParams } from "react-router-dom";

const ServerError = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { status } = useParams();

    const refresh = () => {
        navigate("/");
    };

    const render = () => {
        let content = {
            title: t("500 Server Error"),
            subtitle: t("We lost server..."),
            message: t("Sorry, we are trying to resolve problem, try again in few minutes."),
        };

        if (status === "0") {
            content = {
                title: t("CORS"),
                subtitle: t("We have problem with CORS policy..."),
                message: t("Sorry, we are trying to resolve problem, try again in few minutes."),
            };
        } else if (status === "429") {
            content = {
                title: t("Too many requests"),
                subtitle: t("You made a lot of requests :("),
                message: t("Sorry, please try again in few minutes."),
            };
        }

        const { title, subtitle, message } = content;

        return (
            <div className="container mx-auto py-32 max-w-7xl w-11/12 md:h-[calc(100vh-200px)] xl:w-full">
                <div>
                    <p className="text-primary-500 mb-4">{title}</p>

                    <div className="max-w-xl mb-10">
                        <h1 className="text-6xl mb-6">{subtitle}</h1>
                        <p className="text-xl font-normal text-gray-400">{message}</p>
                    </div>

                    <div className="btn-group">
                        <button onClick={() => refresh()} className="btn btn-primary">
                            {t("Try to go back")}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return render();
};

export default ServerError;