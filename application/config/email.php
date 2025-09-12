<?php
defined('BASEPATH') OR exit('No direct script access allowed');

$config['protocol']   = getenv('SMTP_PROTOCOL') ?: 'smtp';
$config['smtp_host']  = getenv('SMTP_HOST');
$config['smtp_user']  = getenv('SMTP_USER');
$config['smtp_pass']  = getenv('SMTP_PASS');
$config['smtp_port']  = getenv('SMTP_PORT');
$config['smtp_crypto']= getenv('SMTP_ENCRYPTION');

$config['mailtype']   = 'html';
$config['charset']    = 'utf-8';
$config['newline']    = "\r\n";

