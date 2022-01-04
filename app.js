const express = require("express");
const app = express();
const request = require("request");
const fetch = require("node-fetch");
const axios = require("axios");
const cheerio = require("cheerio");
const notifier = require("node-notifier");
const path = require("path");
const port = process.env.PORT || 3000;
let interval;

app.get("/", (req, res) => {
  res.send("Hello from server...");
});
app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});

const getDataFromRemote = async () => {
  const URL = "https://www.cricbuzz.com/cricket-match/live-scores";
  const response = await axios.get(URL);
  const { data } = response;
  return data;
  // console.log(data);
};
const getScores = async () => {
  const html = await getDataFromRemote();
  const scores = [];
  const live_match = [];
  const $ = cheerio.load(html);
  $("a.cb-lv-scrs-well-live").each(function (_, element) {
    const scoreContainer = $(element).children().children();
    var link = $(element).attr("href");
    var title = $(element).attr("title");
    var arr = link.split("/");
    const data = {
      link: link,
      title: title,
      id: arr.length >= 2 ? arr[2] : "1234",
    };

    live_match.push(data);
    const score = $(scoreContainer).text();
    scores.push(score);
  });
  return live_match;
};

const TelegramBot = require("node-telegram-bot-api");

// // replace the value below with the Telegram token you receive from @BotFather
const token = "5093575769:AAEAbb80P0kBo51TbVoIpfhpmxtcDYtK4L8";

// // Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, { polling: true });

let data = [];
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const message = msg["text"];

  if (message == "/stop") {
    bot.sendMessage(chatId, "Maa Chudaiye tab aur kya");
    flag2 = 1;

    clearInterval(interval);
  } else if (message == "/start") {
    let temp = await getScores();
    data = [...temp];

    if (temp.length == 0) {
      bot.sendMessage(chatId, "No live matches.");
    } else {
      // temp.sort();
      bot.sendMessage(
        chatId,
        "Chaliye shuru karte hain.. bina kisi bakchodi ke sath.."
      );
      for (let i = 0; i < temp.length; i++) {
        // console.log(temp[i].link);
        bot.sendMessage(chatId, "Press " + (i + 1) + " for " + temp[i].title);
      }
    }
  } else if (data.length != 0) {
    if (parseInt(message) >= 1 && parseInt(message) <= data.length) {
      let resp = parseInt(message) - 1;
      let pre_comment = "";
      interval = setInterval(async () => {
        var url =
          "https://cricket-api.vercel.app/cri.php?url=https://www.cricbuzz.com/" +
          data[resp].link;
        var url2 =
          "https://www.cricbuzz.com/api/cricket-match/commentary/" +
          data[resp].id;
        let flag = 0;
        fetch(url2)
          .then(function (response) {
            return response.json();
          })
          .then(function (data) {
            const key_val =
              data["commentaryList"][0]["commentaryFormats"]["bold"];
            const over = data["commentaryList"][0]["overNumber"];

            if (over) {
              if (over[over.size() - 1] == "6") flag = 1;
            }

            let mp = {};
            if (key_val) {
              a = key_val["formatId"];
              b = key_val["formatValue"];
              for (let i = 0; i < a.length; i++) {
                mp[a[i]] = b[i];
              }
            }

            let s = data["commentaryList"][0]["commText"];
            // console.log(s);
            for (let i = 0; i < s.length; i++) {
              if (s[i] == "$") {
                let temp = s[i - 2] + s[i - 1] + s[i];

                s = s.replace(temp, mp[temp]);
              }
            }
            s = over ? over + "-" : "" + s;
            if (pre_comment != s) {
              bot.sendMessage(chatId, s);
              pre_comment = s;
            }
          })
          .catch(function (err) {
            console.log(err);
          });
        fetch(url)
          .then(function (response) {
            return response.json();
          })
          .then(function (data) {
            if (flag === 1)
              bot.sendMessage(chatId, data["livescore"]["current"]);
            return data["livescore"]["current"];
          })
          .catch(function (err) {
            console.log(err);
          });
      }, 2000);
    } else {
      bot.sendMessage(chatId, "Dhang ka message likh bhosdike");
    }
  }
});
