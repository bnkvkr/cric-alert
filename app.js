const express = require("express");
const app = express();
const request = require("request");
const fetch = require("node-fetch");
const axios = require("axios");
const cheerio = require("cheerio");
const notifier = require("node-notifier");
const path = require("path");
const port = process.env.PORT || 3000;

let arr = [];

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

const token = "5093575769:AAEAbb80P0kBo51TbVoIpfhpmxtcDYtK4L8";
//const token = "5030146518:AAG2jDfgOS27qfWuMz2l9D3W98jb9uEfp4k";
// // Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, { polling: true });

let data = [];
// let pre_comment = "HEY";
// let flag2 = 0,
//   flag = 0;
const search = async (chatId) => {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i].chatId === chatId) return arr[i];
  }
  return undefined;
};
const deleteobj = async (chatId) => {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i].chatId === chatId) {
      arr.splice(i, 1);
    }
  }
};
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  //console.log(chatId);
  let obj = await search(chatId);
  if (obj == undefined) {
    obj = {};
    obj.chatId = chatId;
    obj.pre_comment = "Hey";
    obj.flag = 0;
    obj.flag2 = 0;
    obj.interval = 0;
    arr.push(obj);
  }
  const message = msg["text"];

  if (message == "/stop") {
    bot.sendMessage(chatId, "Thanks for using.. see you again 👋👋");
    obj.flag2 = 1;

    clearInterval(obj.interval);
    const del = await deleteobj(chatId);
  } else if (message == "/start") {
    let temp = await getScores();
    data = [...temp];

    if (temp.length == 0) {
      bot.sendMessage(chatId, "No live matches.");
    } else {
      // temp.sort();
      bot.sendMessage(chatId, "Hello from cric-alert..👋👋");
      for (let i = 0; i < temp.length; i++) {
        // console.log(temp[i].link);
        bot.sendMessage(chatId, "Press " + (i + 1) + " for " + temp[i].title);
      }
    }
  } else if (data.length != 0) {
    if (parseInt(message) >= 1 && parseInt(message) <= data.length) {
      let resp = parseInt(message) - 1;
      obj.interval = setInterval(async () => {
        var url =
          "https://cricket-api.vercel.app/cri.php?url=https://www.cricbuzz.com/" +
          data[resp].link;
        var url2 =
          "https://www.cricbuzz.com/api/cricket-match/commentary/" +
          data[resp].id;

        fetch(url2)
          .then(function (response) {
            return response.json();
          })
          .then(function (data) {
            let firstKey = Object.keys(
              data["commentaryList"][0]["commentaryFormats"]
            )[0];
            const key_val =
              data["commentaryList"][0]["commentaryFormats"][firstKey];
            let over = 0;
            if (data["commentaryList"][0]["overNumber"])
              over = String(data["commentaryList"][0]["overNumber"]);

            if (
              over &&
              over.length &&
              over[over.length - 1] == "6" &&
              obj.flag == 0
            ) {
              obj.flag = 2;
            } else if (over && over[over.length - 1] == "1" && obj.flag == 1) {
              obj.flag = 0;
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

            s = over ? over + "-" + s : "" + s;
            let result = s.includes(obj.pre_comment);
            //console.log(obj.pre_comment);
            if (obj.pre_comment != s) {
              if (!result) {
                bot.sendMessage(chatId, s);
              }
              obj.pre_comment = s;
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
            if (obj.flag == 2) {
              bot.sendMessage(chatId, data["livescore"]["current"]);
              obj.flag = 1;
            }
            return data["livescore"]["current"];
          })
          .catch(function (err) {
            console.log(err);
          });
      }, 3500);
    } else {
      bot.sendMessage(chatId, "please enter valid input");
    }
  }
});
