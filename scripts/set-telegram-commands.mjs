import 'dotenv/config';

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error("No BOT_TOKEN found in environment.");
  process.exit(1);
}

const commands = [
  { command: "start", description: "Start the bot and see welcome message" },
  { command: "guide", description: "Learn how to play and view combat mechanics" },
  { command: "fight", description: "Challenge someone (reply to their message)" },
  { command: "matchmake", description: "Queue for a random ranked battle" },
  { command: "cancel", description: "Cancel your matchmaking search" },
  { command: "setbey", description: "Customize your Beyblade name (e.g. /setbey Pegasus)" }
];

async function setCommands() {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/setMyCommands`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ commands }),
    });

    const data = await response.json();
    if (data.ok) {
      console.log("Successfully set Telegram bot commands!");
    } else {
      console.error("Failed to set commands:", data);
    }
  } catch (error) {
    console.error("Error setting commands:", error);
  }
}

setCommands();
