<?php session_start(); if(isset($_SESSION['user'])) header("Location: app.php"); ?>
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="style.css">
    <title>Giriş | mcord</title>
</head>
<body>
    <div class="login-container">
        <div class="login-box">
            <h2 style="text-align:center; color:white; margin-bottom:20px;">mcord'a Hoş Geldin</h2>
            <form action="core.php" method="POST">
                <input type="text" name="username" placeholder="Kullanıcı Adı" required style="width:100%; padding:10px; margin-bottom:10px; background:#1e1f22; border:none; color:white;">
                <input type="password" name="password" placeholder="Şifre" required style="width:100%; padding:10px; margin-bottom:20px; background:#1e1f22; border:none; color:white;">
                
                <button type="submit" name="action" value="login" class="login-btn">Giriş Yap</button>
                <button type="submit" name="action" value="register" class="login-btn" style="background:transparent; border:1px solid #5865f2;">Hesap Oluştur</button>
            </form>
        </div>
    </div>
</body>
</html>
