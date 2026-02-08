// assets/js/mcord2.js
const McordChat = {
    send() {
        const input = document.getElementById('chat-input');
        const text = input.value.trim();
        
        if(!text) return;

        // Basit JS tarafı emoji desteği
        let formattedText = text.replace(':smile:', '😊')
                                .replace(':fire:', '🔥')
                                .replace(':heart:', '❤️');

        const container = document.getElementById('messages-flow');
        const html = `
            <div class="message-row">
                <div class="avatar"></div>
                <div class="msg-content">
                    <h4>Sen</h4>
                    <p>${formattedText}</p>
                </div>
            </div>
        `;
        
        container.insertAdjacentHTML('beforeend', html);
        input.value = '';
        container.scrollTop = container.scrollHeight;
    }
};

document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if(e.key === 'Enter') McordChat.send();
});
