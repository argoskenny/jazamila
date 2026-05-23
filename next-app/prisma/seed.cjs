const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

process.env.DATABASE_URL ||= "file:./dev.db";

const prisma = new PrismaClient();

async function main() {
  await prisma.blogLink.deleteMany();
  await prisma.feedback.deleteMany();
  await prisma.post.deleteMany();
  await prisma.restaurant.deleteMany();
  await prisma.user.deleteMany();

  await prisma.restaurant.createMany({
    data: [
      {
        id: 1,
        name: "Sushi House",
        areaNum: "02",
        telNum: "1234567",
        region: 1,
        section: 2,
        address: "台北市大同區民生西路 100 號",
        foodType: 1,
        price: 100,
        openTime: 0,
        closeTime: 0,
        note: "簡單、穩定、午餐很適合快速決定。",
        imageUrl: "preview_1380970870.jpg",
        originalImage: "",
        updatedAtUnix: 0,
        postId: 0,
        closed: 0
      },
      {
        id: 2,
        name: "Burger Place",
        areaNum: "02",
        telNum: "7654321",
        region: 1,
        section: 3,
        address: "台北市中山區南京東路 88 號",
        foodType: 2,
        price: 200,
        openTime: 0,
        closeTime: 0,
        note: "漢堡、薯條和不用想太多的快樂。",
        imageUrl: "preview_1380978779.jpg",
        originalImage: "",
        updatedAtUnix: 0,
        postId: 0,
        closed: 0
      },
      {
        id: 3,
        name: "Pasta Corner",
        areaNum: "02",
        telNum: "1111111",
        region: 2,
        section: 1,
        address: "新北市板橋區文化路 10 號",
        foodType: 3,
        price: 300,
        openTime: 0,
        closeTime: 0,
        note: "想吃義大利麵的時候，這間通常不會出錯。",
        imageUrl: "preview_1380970870.jpg",
        originalImage: "",
        updatedAtUnix: 0,
        postId: 0,
        closed: 0
      }
    ]
  });

  await prisma.blogLink.createMany({
    data: [
      {
        id: 1,
        restaurantId: 1,
        postId: 0,
        name: "Sushi Blog",
        url: "https://example.com/sushi",
        status: 1
      },
      {
        id: 2,
        restaurantId: 2,
        postId: 0,
        name: "Burger Blog",
        url: "https://example.com/burger",
        status: 1
      }
    ]
  });

  await prisma.feedback.create({
    data: {
      id: 1,
      name: "站務測試",
      email: "hello@example.com",
      content: "Next.js 重寫版的第一筆回饋資料。",
      timeUnix: 1710000000,
      isRead: 0
    }
  });

  await prisma.post.create({
    data: {
      id: 1,
      name: "巷口麵店",
      areaNum: "02",
      telNum: "22223333",
      region: 1,
      section: 4,
      address: "台北市萬華區成都路 1 號",
      foodType: 4,
      price: 80,
      openTime: 0,
      closeTime: 0,
      note: "使用者投稿，等待審核。",
      updatedAtUnix: 1710000000,
      imageUrl: "preview_1380970870.jpg",
      originalImage: "",
      status: 0
    }
  });

  await prisma.user.create({
    data: {
      id: 1,
      account: "demo",
      password: await bcrypt.hash("demo1234", 12),
      email: "demo@example.com",
      name: "Demo Member",
      description: "Meet 模組示範會員。"
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
