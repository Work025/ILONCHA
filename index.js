import TelegramBot from "node-telegram-bot-api";

const TOKEN = "8595219989:AAHaZSw98dwQS6itnGCilseXWAaafayA_XY";
const bot = new TelegramBot(TOKEN, { polling: true });

// 🔧 O‘yin sozlamalari
const GRID = 10;
const START_SPEED = 800;

// Global o‘zgaruvchilar
let games = new Map(); // har chat uchun alohida holat

// 🎯 Tasodifiy meva joylash
function randomFood(snake) {
  while (true) {
    const x = Math.floor(Math.random() * GRID);
    const y = Math.floor(Math.random() * GRID);
    if (!snake.some(s => s.x === x && s.y === y)) return { x, y };
  }
}

// 🧩 Grid chizish
function render(state) {
  let txt = "";
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const isSnake = state.snake.some(s => s.x === x && s.y === y);
      const isFood = state.food.x === x && state.food.y === y;
      if (isSnake) txt += "🟩";
      else if (isFood) txt += "🍎";
      else txt += "⬜";
    }
    txt += "\n";
  }
  return `🏆 Ball: ${state.score}\n${txt}`;
}

// 🧠 Harakat hisoblash
function move(state) {
  const head = { ...state.snake[0] };
  const dir = state.dir;

  if (dir === "UP") head.y--;
  if (dir === "DOWN") head.y++;
  if (dir === "LEFT") head.x--;
  if (dir === "RIGHT") head.x++;

  // Chegarani tekshir
  if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) return false;
  // O‘zini yeb qo‘yish
  if (state.snake.some(s => s.x === head.x && s.y === head.y)) return false;

  state.snake.unshift(head);

  // Meva yedi
  if (head.x === state.food.x && head.y === state.food.y) {
    state.score++;
    state.food = randomFood(state.snake);
  } else {
    state.snake.pop();
  }

  return true;
}

// 🎮 Tugmalar (inline)
function keyboard(paused = false) {
  return {
    inline_keyboard: [
      [{ text: "⬆️", callback_data: "UP" }],
      [
        { text: "⬅️", callback_data: "LEFT" },
        { text: paused ? "▶️ Davom et" : "⏸ Pauza", callback_data: "PAUSE" },
        { text: "➡️", callback_data: "RIGHT" },
      ],
      [{ text: "⬇️", callback_data: "DOWN" }],
      [
        { text: "⚡+", callback_data: "SPEED_UP" },
        { text: "🐢−", callback_data: "SPEED_DOWN" },
        { text: "🔄 Restart", callback_data: "RESTART" },
      ],
    ],
  };
}

// 🔁 O‘yin sikli
function startGame(chatId, messageId) {
  const game = games.get(chatId);
  if (game.interval) clearInterval(game.interval);

  game.interval = setInterval(async () => {
    if (game.paused) return;

    const alive = move(game);
    if (!alive) {
      clearInterval(game.interval);
      game.alive = false;
      // Eski xabarni o‘chirish
      try {
        await bot.deleteMessage(chatId, game.messageId);
      } catch {}
      const msg = await bot.sendMessage(chatId, `💀 O‘yin tugadi!\n\n${render(game)}`, {
        reply_markup: {
          inline_keyboard: [[{ text: "🔄 Yangi o‘yin", callback_data: "RESTART" }]],
        },
      });
      game.messageId = msg.message_id;
      return;
    }

    // Eski xabarni o‘chirish
    try {
      await bot.deleteMessage(chatId, game.messageId);
    } catch {}

    const msg = await bot.sendMessage(chatId, render(game), { reply_markup: keyboard(game.paused) });
    game.messageId = msg.message_id;
  }, game.speed);
}

// ▶️ Start komandasi
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const state = {
    snake: [{ x: 5, y: 5 }],
    dir: "RIGHT",
    food: randomFood([{ x: 5, y: 5 }]),
    paused: false,
    speed: START_SPEED,
    score: 0,
    alive: true,
    messageId: null,
    interval: null,
  };
  games.set(chatId, state);
  const sent = await bot.sendMessage(chatId, `🐍 O‘yin boshlandi!\n${render(state)}`, {
    reply_markup: keyboard(),
  });
  state.messageId = sent.message_id;
  startGame(chatId, sent.message_id);
});

// ⚙️ Tugmalarni boshqarish
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const game = games.get(chatId);
  if (!game) return;

  const data = query.data;

  // Restart
  if (data === "RESTART") {
    if (game.interval) clearInterval(game.interval);
    const newGame = {
      snake: [{ x: 5, y: 5 }],
      dir: "RIGHT",
      food: randomFood([{ x: 5, y: 5 }]),
      paused: false,
      speed: START_SPEED,
      score: 0,
      alive: true,
      messageId: game.messageId,
      interval: null,
    };
    games.set(chatId, newGame);
    startGame(chatId, game.messageId);
    bot.answerCallbackQuery(query.id, { text: "🔄 Yangi o‘yin boshlandi!" });
    return;
  }

  // Yo‘nalish
  if (["UP", "DOWN", "LEFT", "RIGHT"].includes(data)) game.dir = data;

  // Pauza
  if (data === "PAUSE") {
    game.paused = !game.paused;
    bot.answerCallbackQuery(query.id, { text: game.paused ? "⏸ Pauza" : "▶️ Davom etdi" });
  }

  // Speed up/down
  if (data === "SPEED_UP") {
    if (game.speed > 200) game.speed -= 100;
    bot.answerCallbackQuery(query.id, { text: `⚡ Tezlik: ${game.speed}ms` });
    startGame(chatId, game.messageId);
  }

  if (data === "SPEED_DOWN") {
    if (game.speed < 2000) game.speed += 100;
    bot.answerCallbackQuery(query.id, { text: `🐢 Sekin: ${game.speed}ms` });
    startGame(chatId, game.messageId);
  }

  bot.answerCallbackQuery(query.id);
});

console.log("🐍 Snake bot ishga tushdi...");
