<?php
// core/Mcord.php
class Mcord {
    public static $version = "1.0.0";

    // Mesajlardaki metinleri emojiye çevirir
    public static function parseText($text) {
        // Güvenlik: XSS önlemi
        $text = htmlspecialchars($text);
        
        $emojis = [
            ':smile:' => '😊',
            ':fire:'  => '🔥',
            ':ok:'    => '👌',
            ':love:'  => '❤️',
            ':cool:'  => '😎'
        ];
        return str_replace(array_keys($emojis), array_values($emojis), $text);
    }
}
