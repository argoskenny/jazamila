<?php
defined('BASEPATH') OR exit('No direct script access allowed');

$config['queue_driver'] = getenv('QUEUE_DRIVER') ?: 'sync';
$config['queue_host']   = getenv('QUEUE_HOST');
$config['queue_port']   = getenv('QUEUE_PORT');

