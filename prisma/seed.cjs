const { PrismaClient } = require("@prisma/client");
const { cuisineTypes: cuisineTypeCatalog } = require("../lib/domain/cuisine-types.json");

process.env.DATABASE_URL ||= "file:./dev.db";

const prisma = new PrismaClient();

async function main() {
  await prisma.restaurantImportIssue.deleteMany();
  await prisma.restaurantTag.deleteMany();
  await prisma.blogLink.deleteMany();
  await prisma.feedback.deleteMany();
  await prisma.post.deleteMany();
  await prisma.restaurant.deleteMany();
  await prisma.cuisineType.deleteMany();
  await prisma.district.deleteMany();
  await prisma.city.deleteMany();
  await prisma.tag.deleteMany();

  await prisma.cuisineType.createMany({
    data: cuisineTypeCatalog.map((cuisineType) => ({
      code: cuisineType.code,
      name: cuisineType.name,
      normalizedName: cuisineType.normalizedName,
      status: cuisineType.status,
      createdBy: cuisineType.createdBy,
      legacyFoodType: cuisineType.legacyFoodType
    }))
  });
  const seededCuisineTypes = await prisma.cuisineType.findMany({
    select: { code: true, legacyFoodType: true }
  });
  const cuisineTypeIdsByLegacyFoodType = new Map(
    seededCuisineTypes
      .filter((cuisineType) => cuisineType.legacyFoodType !== null)
      .map((cuisineType) => [cuisineType.legacyFoodType, cuisineType.code])
  );
  const cuisineTypeIdsByCode = new Map(
    (await prisma.cuisineType.findMany({ select: { id: true, code: true } }))
      .map((cuisineType) => [cuisineType.code, cuisineType.id])
  );

  function cuisineTypeIdForLegacyFoodType(foodType) {
    const code = cuisineTypeIdsByLegacyFoodType.get(foodType);
    return code ? cuisineTypeIdsByCode.get(code) : null;
  }

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
        cuisineTypeId: cuisineTypeIdForLegacyFoodType(1),
        price: 100,
        openTime: 0,
        closeTime: 0,
        note: "簡單、穩定、午餐很適合快速決定。",
        imageUrl: null,
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
        cuisineTypeId: cuisineTypeIdForLegacyFoodType(2),
        price: 200,
        openTime: 0,
        closeTime: 0,
        note: "漢堡、薯條和不用想太多的快樂。",
        imageUrl: null,
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
        cuisineTypeId: cuisineTypeIdForLegacyFoodType(3),
        price: 300,
        openTime: 0,
        closeTime: 0,
        note: "想吃義大利麵的時候，這間通常不會出錯。",
        imageUrl: null,
        originalImage: "",
        updatedAtUnix: 0,
        postId: 0,
        closed: 0
      },
      {
        id: 4,
        name: "Closed Diner",
        areaNum: "02",
        telNum: "33334444",
        region: 1,
        section: 2,
        address: "台北市大同區封存路 1 號",
        foodType: 1,
        cuisineTypeId: cuisineTypeIdForLegacyFoodType(1),
        price: 100,
        openTime: 0,
        closeTime: 0,
        note: "這筆資料用來確認公開頁面不顯示已關閉餐廳。",
        imageUrl: null,
        originalImage: "",
        updatedAtUnix: 0,
        postId: 0,
        closed: 1
      }
    ]
  });

  const taipei = await prisma.city.create({
    data: { code: "taipei", name: "台北市", legacyRegion: 1 }
  });
  const datong = await prisma.district.create({
    data: { cityId: taipei.id, code: "datong", name: "大同區", legacySection: 2 }
  });
  const hotPot = await prisma.tag.create({
    data: { name: "火鍋", normalizedName: "火鍋" }
  });
  const importedRestaurant = await prisma.restaurant.create({
    data: {
      id: 5,
      name: "新資料火鍋店",
      region: 1,
      section: 2,
      address: "台北市大同區測試路 5 號",
      foodType: 0,
      price: 1000,
      priceMin: 400,
      priceMax: 1500,
      phone: "02-5555-1234",
      ratingPlatform: "Google",
      ratingScore: 4.6,
      ratingReviewCount: 321,
      reviewSummaryJson: JSON.stringify(["湯頭選擇多", "服務親切"]),
      businessOpenTime: "11:00",
      businessCloseTime: "22:00",
      externalImageUrl: "https://example.com/hot-pot.jpg",
      cityId: taipei.id,
      districtId: datong.id,
      imageUrl: "preview_1380970870.jpg",
      closed: 0
    }
  });
  await prisma.restaurantTag.create({
    data: { restaurantId: importedRestaurant.id, tagId: hotPot.id, position: 0 }
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
