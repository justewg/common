'use strict';

let code
let colors = {
    FadeOn:        '\u001b[30;1m',  // темносерый болдовый цвет
    Reset:         '\u001b[0m',      // ресет цвета
    
    Black:         '\u001b[30m',
    Red:           '\u001b[31m',
    Green:         '\u001b[32m',
    Yellow:        '\u001b[33m',
    Blue:          '\u001b[34m',
    Magenta:       '\u001b[35m',
    Cyan:          '\u001b[36m',
    White:         '\u001b[37m',
    BrightBlack:   '\u001b[30;1m',
    BrightRed:     '\u001b[31;1m',
    BrightGreen:   '\u001b[32;1m',
    BrightYellow:  '\u001b[33;1m',
    BrightBlue:    '\u001b[34;1m',
    BrightMagenta: '\u001b[35;1m',
    BrightCyan:    '\u001b[36;1m',
    BrightWhite:   '\u001b[37;1m',
}
// плюс добавляем 256 уветов по таблице отсюда: https://www.lihaoyi.com/post/BuildyourownCommandLinewithANSIescapecodes.html#colors
for (let i = 0; i <= 16; i++) {
    for (let j = 0; j <= 16; j++) {
        code = (i * 16 + j)
        colors['c' + code] = '\u001b[38;5;' + code + 'm'
    }
}

module.exports = colors
