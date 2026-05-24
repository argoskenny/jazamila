import { z } from "zod";

export const feedbackSchema = z.object({
  name: z.string().trim().min(1, "請留下稱呼").max(80),
  email: z.string().trim().email("請輸入正確 email").max(120),
  content: z.string().trim().min(1, "請填寫內容").max(4000)
});

export const blogLinkSchema = z.object({
  res_id: z.coerce.number().int().nonnegative(),
  res_blogname: z.string().trim().min(1, "請填寫食記名稱").max(120),
  res_bloglink: z.string().trim().url("請輸入正確網址").max(500)
});

export const restaurantPostSchema = z.object({
  post_name: z.string().trim().min(1, "請填寫餐廳名稱").max(120),
  post_area_num: z.string().trim().max(10).default(""),
  post_tel_num: z.string().trim().max(20).default(""),
  post_region: z.coerce.number().int().nonnegative().default(0),
  post_section: z.coerce.number().int().nonnegative().default(0),
  post_address: z.string().trim().max(255).default(""),
  post_foodtype: z.coerce.number().int().nonnegative().default(0),
  post_price: z.coerce.number().int().nonnegative().default(0),
  post_note: z.string().trim().max(4000).default("")
});

export const restaurantAdminSchema = z.object({
  res_name: z.string().trim().min(1, "請填寫餐廳名稱").max(120),
  res_area_num: z.string().trim().max(10).default("02"),
  res_tel_num: z.string().trim().max(20).default(""),
  res_region: z.coerce.number().int().nonnegative().default(0),
  res_section: z.coerce.number().int().nonnegative().default(0),
  res_address: z.string().trim().max(255).default(""),
  res_foodtype: z.coerce.number().int().nonnegative().default(0),
  res_price: z.coerce.number().int().nonnegative().default(0),
  res_note: z.string().trim().max(4000).default(""),
  res_img_url: z.string().trim().max(255).default("preview_1380970870.jpg")
});
