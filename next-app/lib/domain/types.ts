export type Option = {
  id: number;
  label: string;
};

export type Restaurant = {
  id: number;
  res_name: string;
  res_area_num: string;
  res_tel_num: string;
  res_region: number;
  res_section: number;
  res_address: string;
  res_foodtype: number;
  res_price: number;
  res_open_time: number;
  res_close_time: number;
  res_note: string;
  res_img_url: string;
  res_img_ori_url?: string;
  res_updatetime?: number;
  res_post_id?: number;
  res_close?: number;
};

export type RestaurantView = Restaurant & {
  regionLabel: string;
  sectionLabel: string;
  foodTypeLabel: string;
  telLabel: string;
  priceLabel: string;
  imagePath: string;
};

export type BlogLink = {
  id: number;
  b_res_id: number;
  b_post_id: number;
  b_blogname: string;
  b_bloglink: string;
  b_blog_show: number;
};

export type Feedback = {
  id: number;
  f_name: string;
  f_email: string;
  f_content: string;
  f_time: number;
  f_isread: number;
};

export type Post = {
  id: number;
  post_name: string;
  post_area_num: string;
  post_tel_num: string;
  post_region: number;
  post_section: number;
  post_address: string;
  post_foodtype: number;
  post_price: number;
  post_open_time: number;
  post_close_time: number;
  post_note: string;
  post_updatetime: number;
  post_img_url: string;
  post_img_ori_url?: string;
  post_prove: number;
};

export type MeetUser = {
  id: number;
  account: string;
  email: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
};

export type HomePreferences = {
  remember: number;
  foodwhere_region: number;
  foodwhere_section: number;
  foodmoney_max: number;
  foodmoney_min: number;
  foodtype: number;
};

export type RestaurantCriteria = {
  regionId: number;
  sectionId: number;
  maxPrice: number;
  minPrice: number;
  foodType: number;
};

export type ListFilters = RestaurantCriteria & {
  location: string;
  page: number;
  keyword: string;
};
