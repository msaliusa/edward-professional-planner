"use strict";

//all config params
const config = require("./config.json");
const PAGE_ACCESS_TOKEN = config.page_access_token;
const APIAI_TOKEN = config.api_ai_token;
const FB_VALIDATION_TOKEN = config.fb_validation_token;
const express = require("express");
const bodyParser = require("body-parser");
const request = require("request");
const promise = require("promise");
const apiai = require("apiai");
const moment_tz = require("moment-timezone");
const app = express();
const apiaiApp = apiai(APIAI_TOKEN);
const moment = require("moment");
app.set("port", process.env.PORT || 5000);
let currentTime = moment_tz();
let estTimeStamp = moment_tz.tz(currentTime, "America/Toronto").format();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
const today_date = moment().format("YYYY-MM-DD");
//Server start
const server = app.listen(process.env.PORT || 5000, () => {
  console.log(
    "Express server listening on port %d in %s mode",
    server.address().port,
    app.settings.env + "-" + estTimeStamp
  );
});

/*just static home page */
app.get("/", (req, res) => {
  console.log("Time Stamp :" + estTimeStamp);
  res.send("Home Page");
});

/* For Facebook Validation */
app.get("/webhook", function(req, res) {
  if (
    req.query["hub.mode"] === "subscribe" &&
    req.query["hub.verify_token"] === FB_VALIDATION_TOKEN
  ) {
    console.log("[app.get] Validating webhook");
    res.status(200).send(req.query["hub.challenge"]);
  } else {
    console.error("Failed validation. Make sure the validation tokens match.");
    res.sendStatus(403);
  }
});

/* handle fb webhook incoming messages */
app.post("/webhook", function(req, res) {
  // You must send back a status 200 to let the Messenger Platform know that you've
  // received the callback. Do that right away because the countdown doesn't stop when
  // you're paused on a breakpoint! Otherwise, the request might time out.
  res.sendStatus(200);

  //req body from fb
  var data = req.body;

  // Make sure this is a page subscription
  if (data.object == "page") {
    // entries may be batched so iterate over each one
    data.entry.forEach(function(pageEntry) {
      var pageID = pageEntry.id;
      var timeOfEvent = pageEntry.time;

      // iterate over each messaging event
      pageEntry.messaging.forEach(function(messagingEvent) {
        let propertyNames = [];
        for (var prop in messagingEvent) {
          propertyNames.push(prop);
        }
        console.log(
          "[app.post] Webhook received a messagingEvent with properties:\n ",
          +propertyNames.join()
        );

        if (messagingEvent.message) {
          // someone sent a message
          receivedMessage(messagingEvent);
        } else if (messagingEvent.delivery) {
          // messenger platform sent a delivery confirmation
          receivedDeliveryConfirmation(messagingEvent);
        } else if (messagingEvent.postback) {
          // user replied by tapping one of our postback buttons
          receivedPostback(messagingEvent);
        } else {
          console.log(
            "[app.post] Webhook is not prepared to handle this message."
          );
        }
      });
    });
  }
});

/*
 * Postback Event
 *
 * This event is called when a postback is tapped on a Structured Message. 
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/postback-received
 * 
 */
function receivedPostback(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfPostback = event.timestamp;

  // The 'payload' param is a developer-defined field which is set in a postback
  // button for Structured Messages.
  var payload = event.postback.payload;

  console.log(
    "[receivedPostback] from user (%d) on page (%d) with payload ('%s') " +
      "at (%d)",
    senderID,
    recipientID,
    payload,
    timeOfPostback
  );

  processPayLoad(senderID, payload);
}

function receivedDeliveryConfirmation(event) {
  var senderID = event.sender.id; // the user who sent the message
  var recipientID = event.recipient.id; // the page they sent it from
  var delivery = event.delivery;
  var messageIDs = delivery.mids;
  var watermark = delivery.watermark;
  var sequenceNumber = delivery.seq;

  if (messageIDs) {
    messageIDs.forEach(function(messageID) {
      console.log(
        "[receivedDeliveryConfirmation] Message with ID %s was delivered",
        messageID
      );
    });
  }
  console.log(
    "[receivedDeliveryConfirmation] All messages before timestamp %d were delivered.",
    watermark
  );
}

/* Received message from FB-> send it to api.ai to get action -> GET query from API.ai for the text */

function receivedMessage(event) {
  console.log(JSON.stringify(event));
  let sender = event.sender.id;
  let text = event.message.text;
  let receivedMessage = event.message;

  if (
    receivedMessage.attachments &&
    receivedMessage.attachments[0].payload.url
  ) {
    let attachedImgURL = receivedMessage.attachments[0].payload.url;
    console.log("Received image message : %s" + attachedImgURL);

    //attachment
  } else {
    let apiaiSession = apiaiApp.textRequest(text, { sessionId: sender });

    apiaiSession.on("response", response => {
      console.log(JSON.stringify(response));
      let aiTextAction = response.result.action;
      let aiTextResponse = response.result.fulfillment.speech;
      let aiParameters = response.result.parameters;
      console.log("Returned from NLP API AI-->" + aiTextAction);
      console.log("Returned from NLP API AI-aiParameters->" + aiParameters);

      switch (aiTextAction) {
        case "input.welcome":
          // sendLoginButton(sender);
          sendWelcomeButton(sender);
          break;

        case "recommend":
          get_Recommendation(sender, aiParameters);
          break;
         
        default:
          console.log(
            "\n\nswitch to prepareSendTextMessage Time Stamp :" +
              estTimeStamp +
              "\n"
          );

          break;
      }
    });

    apiaiSession.on("error", error => {
      console.log(error);
    });

    apiaiSession.end();
  }
}

//pass array of template button templateElements /generic
function sendLoginButton(recipientId, templateElements) {
  console.log(
    "[sendHelpOptionsAsButtonTemplates] Sending the help options menu"
  );

  var templateElements = [];

  var oAuth_QBurl =
    "https://appcenter.intuit.com/connect/oauth2?client_id=" + qb_client_id;

  templateElements.push({
    title: "Login to Your Quickbooks",
    buttons: [
      {
        type: "account_link",
        url: oAuth_QBurl
      }
    ]
  });

  sendButtonMessages(recipientId, templateElements);
}

/*format as buttons*/
function sectionButton(title, action, options) {
  var payload = options | {};
  payload = Object.assign(options, { action: action });
  return {
    type: "postback",
    title: title,
    payload: JSON.stringify(payload)
  };
}


function sendButtonMessages(recipientId, templateElements) {
  console.log("[sendButtonMessages] Sending the buttons " + templateElements);

  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: templateElements
        }
      }
    }
  };

  sendMessagetoFB(messageData);
}

function sendButtonTemplates(recipientId, templateElements) {
  console.log("[sendButtonMessages] Sending the buttons " + templateElements);

  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          button: templateElements
        }
      }
    }
  };

  sendMessagetoFB(messageData);
}

function sendWelcomeButton(recipientId) {
  var templateElements = [];

  templateElements.push({
    title: "What you like to do today",
    buttons: [
      sectionButton("send fb button", "action", {}),
      sectionButton("send fb button", "action", {})
    ]
  });

  sendButtonMessages(recipientId, templateElements);

  // });
}



function processPayLoad(recipientId, requestForHelpOnFeature) {
  var templateElements = [];
  var requestPayload = JSON.parse(requestForHelpOnFeature);
  var sectionButton = function(title, action, options) {
    var payload = options | {};
    payload = Object.assign(options, { action: action });
    return {
      type: "postback",
      title: title,
      payload: JSON.stringify(payload)
    };
  };

  var textButton = function(title, action, options) {
    var payload = options | {};
    payload = Object.assign(options, { action: action });
    return {
      content_type: "text",
      title: title,
      payload: JSON.stringify(payload)
    };
  };
  let payloadAction = requestPayload.action;
  console.log("requestPayload.action--" + payloadAction);
  switch (payloadAction) {
      //process buttons
    case "1":

      break;

    default:
  }
}

function prepareTextMessage(recipientId, variants, options) {
  console.log("prepareTextMessage :-" + variants);

  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: variants
    }
  };
  console.log("prepareTextMessage :-" + "messageData");

  sendMessagetoFB(messageData);
}

function sendMessagetoFB(messageData) {
  console.log("Send Message method :-" + JSON.stringify(messageData));
  request(
    {
      url: "https://graph.facebook.com/v2.6/me/messages",
      qs: { access_token: PAGE_ACCESS_TOKEN },
      method: "POST",
      json: messageData
    },
    (error, response) => {
      if (error) {
        console.log("Error sending message: ", error);
      } else if (response.body.error) {
        console.log("Error: in send message ", response.body.error);
      }
    }
  );
}

function prepareSendTextMessage(sender, aiText) {
  let messageData = { recipient: { id: sender }, message: { text: aiText } };
  sendMessagetoFB(messageData);
}

function send_CompanyInfo(recipientId) {
  call_QB_API("/companyinfo/" + config.realmId, "GET", "", true).then(
    function(data) {
      console.log("data--" + JSON.stringify(data));
      var variants = data.CompanyInfo.CompanyName;
      prepareTextMessage(recipientId, variants, "");
    },
    function(err) {
      console.error("%s; %s", err.message, url);
      console.log("%j", err.res.statusCode);
    }
  );
}

function call_someother_API(endPoint, method, post_body, json) {
  var url_endppoint = url + endPoint;
  console.log("url_endppoint--" + url_endppoint);
  if (method == "POST") {
    json = json || false;
    var requestObj = {
      url: url_endppoint,
      method: method,
      headers: {
      },
      form: post_body
    };
    return new promise(function(resolve, reject) {
      request.post(requestObj, function(err, response, body) {
        if (err || response.statusCode !== 200) {
          console.log("api call error-n-" + JSON.stringify(body));
          return reject(err);
        }
        console.log("api call sucess-\n-");

        resolve(JSON.parse(body));
      });
    });
  } else {
    var url_endppoint = url + endPoint;
    console.log(url_endppoint);

    json = json || false;
    var requestObj = {
      url: url_endppoint,
      method: method,

    };
    return new promise(function(resolve, reject) {
      request(requestObj, function(err, response, body) {
        if (err || response.statusCode !== 200) {
          console.log("api call error-n-" + JSON.stringify(body));
          return reject(err);
        }

        console.log("api call sucess-\n-");

        resolve(JSON.parse(body));
      });
    });
  }
}



function get_Recommendation(recipientId, aiParameters) {
  console.log("get_Recommendation--");
  var templateElements = [];
  var params = "";
  call_API("end point", "GET", "", true).then(
    function(data) {
      var variants = "";
      data.QueryResponse.Estimate.forEach(function(item) {
   
      });
      sendButtonMessages(recipientId, templateElements);
    },
    function(err) {
      console.error("%s; %s", err.message, url);
      console.log("%j", err.res.statusCode);
      prepareTextMessage(recipientId, "error occured", " ");
    }
  );
}