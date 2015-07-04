<?php  if ( ! defined('BASEPATH')) exit('No direct script access allowed');
/*
| -------------------------------------------------------------------------
| URI ROUTING
| -------------------------------------------------------------------------
| This file lets you re-map URI requests to specific controller functions.
|
| Typically there is a one-to-one relationship between a URL string
| and its corresponding controller class/method. The segments in a
| URL normally follow this pattern:
|
|	example.com/class/method/id/
|
| In some instances, however, you may want to remap this relationship
| so that a different class/function is called than the one
| corresponding to the URL.
|
| Please see the user guide for complete details:
|
|	http://codeigniter.com/user_guide/general/routing.html
|
| -------------------------------------------------------------------------
| RESERVED ROUTES
| -------------------------------------------------------------------------
|
| There area two reserved routes:
|
|	$route['default_controller'] = 'welcome';
|
| This route indicates which controller class should be loaded if the
| URI contains no data. In the above example, the "welcome" class
| would be loaded.
|
|	$route['404_override'] = 'errors/page_missing';
|
| This route will tell the Router what URI segments to use if those provided
| in the URL cannot be matched to a valid route.
|
*/

// 後台
$route['admin/res_detail/(:any)']			= 'admin/res_detail/$1';
$route['admin/res_edit/(:any)']				= 'admin/res_edit/$1';
$route['admin/res_list/(:any)']				= 'admin/res_list/$1';
$route['admin/save_res_data']				= 'admin/save_res_data';
$route['admin/res_insert']					= 'admin/res_insert';

$route['admin/post_edit/(:any)']			= 'admin/post_edit/$1';
$route['admin/post_unreview/(:any)']		= 'admin/post_unreview/$1';
$route['admin/post_passed/(:any)']			= 'admin/post_passed/$1';
$route['admin/post_unpass/(:any)']			= 'admin/post_unpass/$1';
$route['admin/save_post_data']				= 'admin/save_post_data';

$route['admin/blog_edit/(:any)']			= 'admin/blog_edit/$1';
$route['admin/blog_unreview/(:any)']		= 'admin/blog_unreview/$1';
$route['admin/blog_passed/(:any)']			= 'admin/blog_passed/$1';
$route['admin/blog_unpass/(:any)']			= 'admin/blog_unpass/$1';

$route['admin/feedback_list/(:any)']		= 'admin/feedback_list/$1';

$route['admin/admin_menu']					= 'admin/admin_menu';

$route['admin/fix_address']					= 'admin/fix_address';

$route['admin/logout']						= 'admin/logout';
$route['admin']								= 'admin';

// Ajax
$route['jazamila_ajax/pick']				= 'jazamila_ajax/pick';
$route['jazamila_ajax/check_captcha']		= 'jazamila_ajax/check_captcha';
$route['jazamila_ajax/save_feedback_post']	= 'jazamila_ajax/save_feedback_post';
$route['jazamila_ajax/get_section']			= 'jazamila_ajax/get_section';
$route['jazamila_ajax/get_section_cookie']	= 'jazamila_ajax/get_section_cookie';
$route['jazamila_ajax/listdata_get_section']= 'jazamila_ajax/listdata_get_section';
$route['jazamila_ajax/blog_save']			= 'jazamila_ajax/blog_save';

// Ajax admin
$route['ajax/login']						= 'ajax/login';
$route['ajax/save_res_data']				= 'ajax/save_res_data';
$route['ajax/save_res_pic']					= 'ajax/save_res_pic';
$route['ajax/fix_blog']						= 'ajax/fix_blog';
$route['ajax/pass_blog']					= 'ajax/pass_blog';
$route['ajax/unpass_blog']					= 'ajax/unpass_blog';

// 前台
$route['default_controller']				= 'jazamila/index';
$route['listdata/(:any)']					= 'jazamila/listdata/$1/$2/$3/$4/$5';
$route['detail/(:any)']						= 'jazamila/detail/$1';
$route['map']								= 'jazamila/map';
$route['about']								= 'jazamila/about';
$route['post']								= 'jazamila/post';
$route['CaptchaImg']						= 'jazamila/CaptchaImg';
$route['save_post_data']					= 'jazamila/save_post_data';
$route['(:any)']							= '';

/* End of file routes.php */
/* Location: ./application/config/routes.php */