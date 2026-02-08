<?php require 'core.php'; if(!isset($_SESSION['user'])) header("Location: index.php"); ?>
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <link rel="stylesheet" href="style.css">
    <title>mcord</title>
</head>
<body>

    <nav class="server-bar">
        <div class="server-icon" style="background:#5865f2">M</div>
        <div style="height:2px; width:30px; background:#35373c;"></div>
        <div class="server-icon" style="background:#23a559">+</div>
        <div class="server-icon" onclick="location.href='core.php?logout=true'" style="margin-top:auto; background:#f23f42">X</div>
    </nav>

    <aside class="list-panel">
        <div class="panel-header">Arkadaşlar</div>
        <div id="userList" class="user-list">
            </div>
        <div style="background:#232428; padding:10px; display:flex; align-items:center;">
            <div class="avatar">S</div>
            <div style="font-weight:bold; font-size:14px;"><?php echo $_SESSION['user']; ?></div>
            <a href="core.php?logout=true" style="margin-left:auto; color:#f23f42; text-decoration:none; font-size:12px;">Çıkış</a>
        </div>
    </aside>

    <main class="chat-panel" id="chatPanel">
        <div class="chat-header">
            <div style="display:flex; align-items:center;">
                <button class="back-btn" onclick="closeChat()">&#8592;</button>
                <span style="font-size:20px; margin-right:5px; color:#949ba4">@</span>
                <span id="chatTitle">Kullanıcı Seç</span>
            </div>
        </div>

        <div class="messages" id="messageBox">
            <div style="text-align:center; color:gray; margin-top:50px;">
                Mesajlaşmak için listeden birine tıkla!
            </div>
        </div>

        <div class="input-area">
            <div class="input-wrapper">
                <input type="text" id="msgInput" placeholder="Mesaj gönder..." disabled>
                <span style="font-size:20px; cursor:pointer;">🚀</span>
            </div>
        </div>
    </main>

    <script src="script.js"></script>
</body>
</html>
