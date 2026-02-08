<?php
require_once 'core/Mcord.php';
require_once 'core/ThemeManager.php';
$tm = new ThemeManager();
?>
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>mcord | Proje</title>
    <link rel="stylesheet" href="assets/css/main.css">
    <link rel="stylesheet" href="assets/css/themes.css">
</head>
<body>

<div class="app-container">
    <nav class="server-sidebar">
        <div class="server-icon" style="background: #5865f2;">M</div>
        <hr style="width: 32px; border: 1px solid #35373c;">
        
        <?php foreach($tm->getColors() as $hex => $name): ?>
            <div class="server-icon" 
                 style="background: <?php echo $hex; ?>" 
                 title="<?php echo $name; ?>"
                 onclick="McordApp.setColor('<?php echo $hex; ?>')">
            </div>
        <?php endforeach; ?>
    </nav>

    <aside class="channel-sidebar">
        <div class="channel-header">mcord Sunucusu</div>
        <div class="channel-list">
            <div class="channel-item active"># genel</div>
            <div class="channel-item"># kurallar</div>
            <div class="channel-item"># sohbet</div>
            
            <br>
            <div style="padding: 10px; color: #aaa; font-size: 0.8rem;">TEMA AYARLARI</div>
            <select onchange="McordApp.setTheme(this.value)" style="width: 90%; margin: 0 5%; padding: 5px; background: #111; color: white; border: none;">
                <?php foreach($tm->getThemes() as $key => $val): ?>
                    <option value="<?php echo $key; ?>">
                        <?php echo $val['icon'] . ' ' . $val['name']; ?>
                    </option>
                <?php endforeach; ?>
            </select>
        </div>
    </aside>

    <main class="chat-area">
        <div id="messages-flow" class="messages-wrapper">
            <div class="message-row">
                <div class="avatar" style="background: gray;"></div>
                <div class="msg-content">
                    <h4>Sistem</h4>
                    <p>Hoş geldin! Soldaki renk toplarına tıklayarak rengi, kanal listesinden temayı değiştirebilirsin.</p>
                </div>
            </div>
        </div>
        
        <div class="input-area">
            <input type="text" id="chat-input" placeholder="# genel kanalına mesaj gönder...">
        </div>
    </main>
</div>

<script src="assets/js/mcord.js"></script>
<script src="assets/js/mcord2.js"></script>
</body>
</html>
