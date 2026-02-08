<?php
// core/Database.php
class Database {
    private static $pdo = null;

    public static function connect() {
        if (self::$pdo == null) {
            try {
                // Veritabanı bilgilerini buraya gireceksin
                self::$pdo = new PDO("mysql:host=localhost;dbname=mcord;charset=utf8", "root", "");
                self::$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            } catch (PDOException $e) {
                // Bağlantı hatası olursa sessizce devam et (şimdilik)
                return null;
            }
        }
        return self::$pdo;
    }
}
