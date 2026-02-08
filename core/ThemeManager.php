<?php
// core/ThemeManager.php
class ThemeManager {
    public $config;

    public function __construct() {
        $this->config = require __DIR__ . '/../config/settings.php';
    }

    public function getThemes() {
        return $this->config['themes'];
    }

    public function getColors() {
        return $this->config['colors'];
    }
}
