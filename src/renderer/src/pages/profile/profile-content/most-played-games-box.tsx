import { useCallback, useContext } from "react";
import { userProfileContext } from "@renderer/context";
import { useTranslation } from "react-i18next";
import { useFormat } from "@renderer/hooks";
import { Link } from "@renderer/components";
import { buildGameDetailsPath } from "@renderer/helpers";
import { MAX_MINUTES_TO_SHOW_IN_PLAYTIME } from "@renderer/constants";
import type { UserGame } from "@types";
import "./most-played-games-box.scss";

const MAX_GAMES = 5;

export function MostPlayedGamesBox() {
  const { libraryGames, pinnedGames } = useContext(userProfileContext);
  const { t } = useTranslation("user_profile");
  const { numberFormatter } = useFormat();

  const formatPlayTime = useCallback(
    (game: UserGame) => {
      const seconds = game.playTimeInSeconds || 0;
      const minutes = seconds / 60;

      if (minutes < MAX_MINUTES_TO_SHOW_IN_PLAYTIME) {
        return t("amount_minutes_short", { amount: minutes.toFixed(0) });
      }

      const hours = minutes / 60;
      return t("amount_hours_short", {
        amount: numberFormatter.format(hours),
      });
    },
    [numberFormatter, t]
  );

  const allGames = [...pinnedGames, ...libraryGames];
  const uniqueGames = allGames.filter(
    (game, index, self) =>
      self.findIndex((g) => g.objectId === game.objectId) === index
  );

  const topGames = uniqueGames
    .filter((game) => game.playTimeInSeconds > 0)
    .sort((a, b) => b.playTimeInSeconds - a.playTimeInSeconds)
    .slice(0, MAX_GAMES);

  if (topGames.length === 0) return null;

  const maxPlayTime = topGames[0].playTimeInSeconds;

  return (
    <div className="most-played__box">
      <ol className="most-played__list">
        {topGames.map((game, index) => {
          const barWidth = (game.playTimeInSeconds / maxPlayTime) * 100;

          return (
            <li key={game.objectId} className="most-played__item">
              <Link
                to={buildGameDetailsPath(game)}
                className="most-played__link"
              >
                <span className="most-played__rank">{index + 1}</span>

                {game.iconUrl && (
                  <img
                    className="most-played__icon"
                    src={game.iconUrl}
                    alt={game.title}
                  />
                )}

                <div className="most-played__details">
                  <span className="most-played__title">{game.title}</span>
                  <div className="most-played__bar-container">
                    <div
                      className="most-played__bar"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>

                <span className="most-played__time">
                  {formatPlayTime(game)}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
