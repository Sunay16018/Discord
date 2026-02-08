<?php
session_start();
$db_file = __DIR__ . '/mcord.db';

try {
    $db = new PDO("sqlite:$db_file");
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Tabloları oluştur
    $db->exec("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT UNIQUE, password TEXT)");
    $db->exec("CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY, sender TEXT, receiver TEXT, msg TEXT, time DATETIME DEFAULT CURRENT_TIMESTAMP)");

} catch (PDOException $e) { die("Veritabanı Hatası: " . $e->getMessage()); }

// --- İŞLEMLER ---

// Kayıt ve Giriş
if (isset($_POST['action'])) {
    $u = trim(htmlspecialchars($_POST['username']));
    $p = $_POST['password'];
    
    if ($_POST['action'] == 'register') {
        $hash = password_hash($p, PASSWORD_DEFAULT);
        try {
            $stmt = $db->prepare("INSERT INTO users (username, password) VALUES (?, ?)");
            $stmt->execute([$u, $hash]);
            $_SESSION['user'] = $u;
            header("Location: app.php");
        } catch (Exception $e) { header("Location: index.php?error=taken"); }
    } else {
        $stmt = $db->prepare("SELECT * FROM users WHERE username = ?");
        $stmt->execute([$u]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($user && password_verify($p, $user['password'])) {
            $_SESSION['user'] = $u;
            header("Location: app.php");
        } else { header("Location: index.php?error=wrong"); }
    }
    exit;
}

// Çıkış
if (isset($_GET['logout'])) { session_destroy(); header("Location: index.php"); exit; }

// Mesaj Gönder (AJAX)
if (isset($_POST['send_msg'])) {
    $stmt = $db->prepare("INSERT INTO messages (sender, receiver, msg) VALUES (?, ?, ?)");
    $stmt->execute([$_SESSION['user'], $_POST['receiver'], htmlspecialchars($_POST['msg'])]);
    exit;
}

// Mesajları Getir (AJAX)
if (isset($_GET['get_chat'])) {
    $me = $_SESSION['user'];
    $friend = $_GET['get_chat'];
    $stmt = $db->prepare("SELECT * FROM messages WHERE (sender=? AND receiver=?) OR (sender=? AND receiver=?) ORDER BY time ASC");
    $stmt->execute([$me, $friend, $friend, $me]);
    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    exit;
}

// Kullanıcı Listesi (AJAX)
if (isset($_GET['get_users'])) {
    $stmt = $db->query("SELECT username FROM users");
    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    exit;
}
?>
