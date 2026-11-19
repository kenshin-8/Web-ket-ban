// Dữ liệu và hàm vẽ Avatar dùng chung cho avatar.js, profile.js, discover.js, match.js
// Mỗi giá trị đều được kiểm tra theo danh sách cho phép (an toàn khi render từ dữ liệu người dùng).

const sw = a => a.map(v => [v, v]);

/** Danh sách tùy chọn: dùng cho cả giao diện Avatar Studio lẫn kiểm tra dữ liệu. */
export const OPTIONS = [
    { key: "hair", label: "Kiểu tóc", type: "select", values: [["short", "Tóc ngắn"], ["long", "Tóc dài"], ["curly", "Tóc xoăn"], ["spiky", "Tóc dựng"], ["bob", "Tóc bob"], ["wavy", "Tóc sóng rẽ ngôi"], ["ponytail", "Tóc đuôi ngựa"], ["bun", "Tóc búi"], ["buzz", "Tóc cua"], ["afro", "Tóc afro"]] },
    { key: "hairColor", label: "Màu tóc", type: "color", values: sw(["#30251f", "#5b3828", "#a3442d", "#d49a42", "#e8dcc2", "#8b8b96", "#34235e", "#b84d68", "#2f6fba", "#1fa89a"]) },
    { key: "face", label: "Khuôn mặt", type: "select", values: [["round", "Mặt tròn"], ["oval", "Mặt trái xoan"], ["square", "Mặt vuông"], ["heart", "Mặt trái tim"]] },
    { key: "skin", label: "Màu da", type: "color", values: sw(["#fbe1cf", "#f1c7a5", "#e3b48a", "#d99b70", "#c08460", "#a96f50", "#8d5b42", "#6b4430"]) },
    { key: "eyes", label: "Kiểu mắt", type: "select", values: [["normal", "Mắt tự nhiên"], ["big", "Mắt to long lanh"], ["happy", "Mắt cười"], ["wink", "Nháy mắt"], ["cool", "Mắt cá tính"]] },
    { key: "eyeColor", label: "Màu mắt", type: "color", values: sw(["#3a2a20", "#8a6d3b", "#2e8b57", "#2f6fba", "#7a5cff", "#5a6572"]) },
    { key: "brows", label: "Lông mày", type: "select", values: [["soft", "Mềm mại"], ["straight", "Thẳng"], ["arched", "Cong"], ["thick", "Đậm"], ["none", "Không"]] },
    { key: "mouth", label: "Biểu cảm", type: "select", values: [["smile", "Mỉm cười"], ["neutral", "Bình thường"], ["happy", "Cười tươi"], ["cat", "Cười mèo"], ["smirk", "Cười nhếch"], ["wow", "Ngạc nhiên"]] },
    { key: "beard", label: "Râu", type: "select", values: [["none", "Không râu"], ["stubble", "Râu lún phún"], ["mustache", "Ria mép"], ["beard", "Râu quai nón"]] },
    { key: "accessory", label: "Phụ kiện", type: "select", values: [["none", "Không"], ["round", "Kính tròn"], ["square", "Kính vuông"], ["shades", "Kính râm"], ["headphones", "Tai nghe"], ["catears", "Tai mèo"], ["flower", "Hoa cài tóc"], ["beanie", "Mũ len"], ["halo", "Hào quang"], ["pet", "Thú cưng đi kèm"]] },
    { key: "outfit", label: "Trang phục", type: "select", values: [["casual", "Thường ngày"], ["hoodie", "Áo hoodie"], ["formal", "Lịch sự"], ["sport", "Thể thao"], ["fantasy", "Giả tưởng"], ["aodai", "Áo dài"]] },
    { key: "outfitColor", label: "Màu trang phục", type: "color", values: sw(["#6c63ff", "#a855f7", "#f06fa4", "#e5484d", "#ff8a3d", "#f4c542", "#28a745", "#14a89a", "#2f9bd9", "#333333"]) },
    { key: "bg", label: "Nền", type: "color", values: [["aurora", "#8f7cff"], ["sunset", "#ff9a7a"], ["ocean", "#4fb7e8"], ["mint", "#6fdcb0"], ["lilac", "#c9a8ff"], ["rose", "#ff8fb3"], ["night", "#33335f"], ["cream", "#f4e6cf"]] }
];

const BGS = {
    aurora: ["#b9a9ff", "#6f8cff"],
    sunset: ["#ffd1a0", "#ff7e8b"],
    ocean: ["#a7e6ff", "#3d8fe0"],
    mint: ["#c8f7dc", "#43c59e"],
    lilac: ["#efe0ff", "#a98bff"],
    rose: ["#ffd3e2", "#ff7fa8"],
    night: ["#4b4a8f", "#1d1d3c"],
    cream: ["#fff6e5", "#f0d9b5"]
};
const DEFAULT_OUTFIT_COLOR = { casual: "#6c63ff", sport: "#28a745", formal: "#333333", fantasy: "#a855f7" };

export const skins = OPTIONS.find(o => o.key === "skin").values.map(v => v[0]);
export const hairColors = OPTIONS.find(o => o.key === "hairColor").values.map(v => v[0]);
export const defaultAvatar = {
    hair: "short",
    hairColor: "#30251f",
    face: "round",
    skin: "#f1c7a5",
    eyes: "normal",
    eyeColor: "#3a2a20",
    brows: "soft",
    mouth: "smile",
    beard: "none",
    accessory: "none",
    outfit: "casual",
    outfitColor: "#6c63ff",
    bg: "aurora"
};

const hairstyles = {
    short: { back: "M65 95 Q55 20 120 25 Q185 20 175 95 L170 160 L70 160 Z", front: "M68 95 Q75 35 120 45 Q165 35 172 95 Q150 70 130 80 Q100 60 68 95" },
    long: { back: "M65 90 Q55 20 120 25 Q185 20 175 90 L190 235 L50 235 Z", front: "M68 95 Q75 35 120 45 Q165 35 172 95 Q150 70 130 80 Q100 60 68 95" },
    curly: { back: "M65 95 Q40 20 85 25 Q100 0 120 25 Q150 0 160 30 Q200 35 175 100 L170 160 L70 160 Z", front: "M68 95 Q55 65 85 65 Q95 35 120 55 Q145 30 155 65 Q180 60 172 95 Q145 75 120 85 Q95 70 68 95" },
    spiky: { back: "M65 95 L55 45 L85 55 L90 15 L115 45 L140 10 L145 50 L180 35 L172 95 L170 160 L70 160 Z", front: "M68 95 L80 55 L100 75 L120 40 L135 75 L160 50 L172 95 Q140 75 120 85 Q95 70 68 95" },
    bob: { back: "M62 100 Q52 20 120 24 Q188 20 178 100 L182 172 Q150 188 120 180 Q90 188 58 172 Z", front: "M66 102 Q68 38 120 42 Q172 38 174 102 Q160 70 124 68 Q92 72 66 102 Z" },
    wavy: { back: "M64 100 Q52 22 120 24 Q188 22 176 100 Q186 150 176 190 Q160 200 158 172 L82 172 Q80 200 64 190 Q54 150 64 100 Z", front: "M67 102 Q68 40 115 42 Q168 40 173 102 Q166 76 138 62 Q112 92 67 102 Z" },
    ponytail: { back: "M65 95 Q55 20 120 25 Q185 20 175 95 L170 140 L70 140 Z M168 62 Q226 58 216 128 Q210 176 186 196 Q198 140 172 108 Z", front: "M68 95 Q75 35 120 45 Q165 35 172 95 Q150 70 130 80 Q100 60 68 95" },
    bun: { back: "M68 95 Q58 28 120 30 Q182 28 172 95 L170 140 L70 140 Z M103 28 a17 17 0 1 0 34 0 a17 17 0 1 0 -34 0", front: "M69 98 Q76 44 120 46 Q164 44 171 98 Q150 70 120 72 Q90 70 69 98 Z" },
    buzz: { back: "M70 92 Q62 30 120 30 Q178 30 170 92 L168 110 L72 110 Z", front: "M72 90 Q80 52 120 50 Q160 52 168 90 Q150 66 120 66 Q90 66 72 90 Z" },
    afro: { back: "M60 105 Q22 62 48 34 Q70 2 120 10 Q170 2 192 34 Q218 62 180 105 L176 130 L64 130 Z", front: "M70 94 Q78 50 120 48 Q162 50 170 94 Q150 72 120 72 Q90 72 70 94 Z" }
};
const faces = {
    round: "M120 50 C65 50 65 90 70 125 C75 165 95 180 120 180 C145 180 165 165 170 125 C175 90 175 50 120 50 Z",
    oval: "M120 45 C80 45 75 90 80 130 C85 170 100 185 120 185 C140 185 155 170 160 130 C165 90 160 45 120 45 Z",
    square: "M75 65 Q75 50 95 50 L145 50 Q165 50 165 70 L165 135 Q165 175 120 180 Q75 175 75 135 Z",
    heart: "M71 88 C70 48 170 48 169 88 C168 130 150 172 120 186 C90 172 72 130 71 88 Z"
};
const beards = {
    stubble: '<path d="M79 126 Q82 176 120 184 Q158 176 161 126 Q150 160 120 162 Q90 160 79 126 Z" fill="#000" opacity=".16"/>',
    mustache: 'M104 141 Q112 133 120 139 Q128 133 136 141 Q128 145 120 143 Q112 145 104 141 Z',
    beard: 'M76 120 Q78 182 120 190 Q162 182 164 120 Q158 150 138 154 Q120 146 102 154 Q82 150 76 120 Z'
};

const clamp = n => Math.max(0, Math.min(255, Math.round(n)));
function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16), t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    return "#" + [n >> 16, (n >> 8) & 255, n & 255].map(c => clamp(c + (t - c) * p).toString(16).padStart(2, "0")).join("");
}

export function sanitizeAvatar(data) {
    const a = { ...defaultAvatar }, src = data || {};
    for (const o of OPTIONS) if (o.values.some(v => v[0] === src[o.key])) a[o.key] = src[o.key];
    if (!OPTIONS.find(o => o.key === "outfitColor").values.some(v => v[0] === src.outfitColor)) {
        a.outfitColor = DEFAULT_OUTFIT_COLOR[a.outfit] || defaultAvatar.outfitColor;
    }
    return a;
}

function eyesMarkup(style, iris, skin) {
    const y = 112, ink = "#2a1d1a";
    const open = (x, big) => {
        const rx = big ? 8.2 : 6.2, ry = big ? 10.2 : 8.2;
        return `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#fff"/>`
            + `<ellipse cx="${x}" cy="${y + 1}" rx="${rx - 1.4}" ry="${ry - 1.4}" fill="${iris}"/>`
            + `<ellipse cx="${x}" cy="${y + 1}" rx="${rx - 3.8}" ry="${ry - 3.8}" fill="#1b1416"/>`
            + `<circle cx="${x - 2.4}" cy="${y - 3.2}" r="${big ? 2.9 : 2.1}" fill="#fff"/>`
            + `<circle cx="${x + 2.4}" cy="${y + 3.4}" r="${big ? 1.5 : 1.1}" fill="#fff" opacity=".85"/>`
            + (big ? `<path d="M${x - rx} ${y - 5} l-4 -3 M${x + rx} ${y - 5} l4 -3" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>` : "");
    };
    const arc = x => `<path d="M${x - 9} ${y + 3} Q${x} ${y - 10} ${x + 9} ${y + 3}" stroke="${ink}" stroke-width="3.6" fill="none" stroke-linecap="round"/>`;
    const half = x => open(x)
        + `<path d="M${x - 8.5} ${y - 9} H${x + 8.5} V${y - 1} Q${x} ${y + 1.5} ${x - 8.5} ${y - 1} Z" fill="${skin}"/>`
        + `<path d="M${x - 9} ${y - 1} Q${x} ${y + 2} ${x + 9} ${y - 1}" stroke="${ink}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
    switch (style) {
        case "big": return open(100, true) + open(140, true);
        case "happy": return arc(100) + arc(140);
        case "wink": return open(100) + arc(140);
        case "cool": return half(100) + half(140);
        default: return open(100) + open(140);
    }
}

const BROWS = {
    soft: ["M90 99 Q100 92 110 97", "M130 97 Q140 92 150 99", 3.5],
    straight: ["M90 97 L110 97", "M130 97 L150 97", 3.5],
    arched: ["M89 101 Q100 88 111 96", "M129 96 Q140 88 151 101", 3.5],
    thick: ["M89 99 Q100 91 111 97", "M129 97 Q140 91 151 99", 6]
};

const MOUTHS = {
    smile: '<path d="M108 145 Q120 155 132 145" stroke="#a34f4f" stroke-width="3.2" fill="none" stroke-linecap="round"/>',
    neutral: '<path d="M108 150 L132 150" stroke="#a34f4f" stroke-width="3.2" fill="none" stroke-linecap="round"/>',
    happy: '<path d="M104 140 Q120 180 136 140 Z" fill="#8f3343"/><path d="M107 141 Q120 148 133 141 L131 145 Q120 151 109 145 Z" fill="#fff"/><path d="M112 158 Q120 150 128 158 Q120 164 112 158 Z" fill="#e8707f"/>',
    cat: '<path d="M105 144 Q112.5 153 120 146 Q127.5 153 135 144" stroke="#a34f4f" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    smirk: '<path d="M108 149 Q122 153 135 142" stroke="#a34f4f" stroke-width="3.2" fill="none" stroke-linecap="round"/>',
    wow: '<ellipse cx="120" cy="150" rx="6.2" ry="8.2" fill="#8f3343"/>'
};

function outfitMarkup(o, c, skinDark) {
    const dk = shade(c, -0.22);
    const lt = shade(c, 0.16);
    const body = `<path d="M62 192 Q120 165 178 192 L204 290 L36 290 Z" fill="${c}"/>`
        + `<path d="M62 192 Q120 165 178 192 L172 205 Q120 182 68 205 Z" fill="#000" opacity=".1"/>`
        + `<path d="M72 195 Q120 173 168 195" stroke="${lt}" stroke-width="2" fill="none" opacity=".45"/>`;
    switch (o) {
        case "hoodie":
            return `<path d="M78 190 Q120 156 162 190 Q160 222 120 228 Q80 222 78 190 Z" fill="${dk}"/>`
                + body
                + `<path d="M98 182 Q120 214 142 182 Q120 192 98 182 Z" fill="${skinDark}"/>`
                + `<path d="M98 182 Q120 214 142 182" stroke="${dk}" stroke-width="5" fill="none"/>`
                + `<path d="M110 208 V246 M130 208 V246" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`;
        case "formal":
            return body
                + `<path d="M98 180 L120 222 L142 180 Z" fill="#fff"/>`
                + `<path d="M90 184 L120 270 L104 186 Z M150 184 L120 270 L136 186 Z" fill="${dk}"/>`
                + `<path d="M116 206 L124 206 L128 252 L120 264 L112 252 Z" fill="#d6455d"/>`;
        case "sport":
            return body
                + `<path d="M96 180 Q120 206 144 180" stroke="#fff" stroke-width="6" fill="none"/>`
                + `<path d="M47 242 L193 242 L197 258 L43 258 Z" fill="#fff" opacity=".9"/>`;
        case "fantasy":
            return body
                + `<path d="M62 192 Q120 165 178 192 L170 216 Q120 190 70 216 Z" fill="#f4c542"/>`
                + `<path d="M98 182 Q120 206 142 182 Q120 192 98 182 Z" fill="${skinDark}"/>`
                + `<circle cx="120" cy="212" r="7.5" fill="#ff5c8a" stroke="#fff" stroke-width="2"/>`;
        case "aodai":
            return body
                + `<path d="M104 172 H136 V198 Q120 208 104 198 Z" fill="${dk}"/>`
                + `<path d="M104 198 Q96 220 84 246" stroke="#f4c542" stroke-width="3.2" fill="none" stroke-linecap="round"/>`
                + `<circle cx="96" cy="214" r="2.6" fill="#f4c542"/><circle cx="89" cy="230" r="2.6" fill="#f4c542"/>`
                + `<path d="M120 208 V290" stroke="#fff" stroke-width="2" opacity=".35"/>`;
        default:
            return body
                + `<path d="M100 181 Q120 208 140 181 Z" fill="${skinDark}"/>`
                + `<path d="M98 181 Q120 210 142 181" stroke="${dk}" stroke-width="5" fill="none"/>`;
    }
}

function accessoryMarkup(k) {
    const ink = "#2b2b35";
    switch (k) {
        case "round": return `<g fill="#fff" fill-opacity=".2" stroke="${ink}" stroke-width="3"><circle cx="100" cy="112" r="15"/><circle cx="140" cy="112" r="15"/></g><path d="M115 111 Q120 106 125 111 M85 109 L72 105 M155 109 L168 105" stroke="${ink}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
        case "square": return `<g fill="#fff" fill-opacity=".2" stroke="${ink}" stroke-width="3"><rect x="84" y="99" width="32" height="25" rx="7"/><rect x="124" y="99" width="32" height="25" rx="7"/></g><path d="M116 108 H124 M84 107 L72 104 M156 107 L168 104" stroke="${ink}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
        case "shades": return `<g fill="#1d1d26" stroke="${ink}" stroke-width="3"><rect x="83" y="99" width="34" height="25" rx="9"/><rect x="123" y="99" width="34" height="25" rx="9"/></g><path d="M91 106 L100 104 M131 106 L140 104" stroke="#fff" stroke-width="3" opacity=".55" stroke-linecap="round"/><path d="M117 107 H123 M83 106 L72 103 M157 106 L168 103" stroke="${ink}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
        case "headphones": return `<path d="M67 118 Q64 26 120 28 Q176 26 173 118" stroke="#2b2b35" stroke-width="7" fill="none" stroke-linecap="round"/><rect x="56" y="104" width="18" height="34" rx="9" fill="#ff5c8a"/><rect x="166" y="104" width="18" height="34" rx="9" fill="#ff5c8a"/>`;
        case "flower": return '<g transform="translate(160 64)"><g fill="#ff8fb3"><circle cy="-9" r="7"/><circle cx="9" r="7"/><circle cy="9" r="7"/><circle cx="-9" r="7"/></g><circle r="5.2" fill="#ffd34d"/></g>';
        case "beanie": return '<path d="M65 90 Q60 22 120 20 Q180 22 175 90 Q120 76 65 90 Z" fill="#ff7e5f"/><path d="M63 84 Q120 70 177 84 L177 100 Q120 86 63 100 Z" fill="#e5563a"/><circle cx="120" cy="18" r="9" fill="#fff"/>';
        case "halo": return '<ellipse class="avatar-halo" cx="120" cy="22" rx="38" ry="9" fill="none" stroke="#ffd54f" stroke-width="6" opacity=".95"/><ellipse cx="120" cy="22" rx="30" ry="5" fill="none" stroke="#fff4b0" stroke-width="2"/>';
        case "pet": return '<g class="avatar-pet" transform="translate(190 190)"><circle r="19" fill="#fff0f4" stroke="#d96b91" stroke-width="3"/><path d="M-14 -9 L-20 -25 L-5 -18 M14 -9 L20 -25 L5 -18" fill="#ffb3c8" stroke="#d96b91" stroke-width="2"/><circle cx="-6" cy="-2" r="2.6" fill="#49333b"/><circle cx="6" cy="-2" r="2.6" fill="#49333b"/><path d="M-4 7 Q0 11 4 7" fill="none" stroke="#b85a78" stroke-width="2.2" stroke-linecap="round"/></g>';
        default: return "";
    }
}

let uidCounter = 0;
function renderAvatar(a) {
    const u = "av" + (++uidCounter);
    const [b1, b2] = BGS[a.bg] || BGS.aurora;
    const skin = a.skin;
    const skinDark = shade(skin, -0.14);
    const hc = a.hairColor;
    const hairDark = shade(hc, -0.2);
    const hair = hairstyles[a.hair] || hairstyles.short;
    const browC = shade(hc, -0.15);
    const br = BROWS[a.brows];

    const gradient = (id, c1, c2, vertical = true) =>
        `<linearGradient id="${id}" x1="0" y1="0" x2="${vertical ? 0 : 1}" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>`;

    const beard = a.beard === "mustache"
        ? `<path d="${beards.mustache}" fill="${hairDark}"/>`
        : a.beard === "beard"
            ? `<path d="${beards.beard}" fill="${hairDark}"/>`
            : a.beard === "stubble"
                ? beards.stubble
                : "";

    return `<defs>`
        + `${gradient(u + "b", b1, b2)}`
        + `${gradient(u + "h", shade(hc, 0.16), shade(hc, -0.16))}`
        + `<radialGradient id="${u}s" cx=".5" cy=".38" r=".72"><stop offset="0" stop-color="${shade(skin, 0.15)}"/><stop offset="1" stop-color="${skin}"/></radialGradient>`
        + `<radialGradient id="${u}glow" cx=".5" cy=".45" r=".55"><stop offset="0" stop-color="#fff" stop-opacity=".26"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`
        + `</defs>`
        + `<rect x="0" y="0" width="240" height="240" fill="url(#${u}b)"/>`
        + `<circle cx="120" cy="120" r="108" fill="url(#${u}glow)"/>`
        + `<circle cx="42" cy="38" r="22" fill="#fff" opacity=".16"/><circle cx="205" cy="190" r="28" fill="#fff" opacity=".12"/>`
        + `<circle cx="195" cy="46" r="6" fill="#fff" opacity=".28"/><circle cx="38" cy="198" r="9" fill="#fff" opacity=".14"/>`
        + `<g transform="translate(24 0) scale(.8)">`
        + (a.accessory === "catears" ? `<path d="M74 66 L80 18 L112 42 Z M166 66 L160 18 L128 42 Z" fill="${hc}"/><path d="M82 52 L85 30 L101 43 Z M158 52 L155 30 L139 43 Z" fill="#ff9db8"/>` : "")
        + `<path d="${hair.back}" fill="url(#${u}h)"/>`
        + `<rect x="105" y="150" width="30" height="44" rx="10" fill="${skinDark}"/>`
        + outfitMarkup(a.outfit, a.outfitColor, skinDark)
        + `<ellipse cx="68" cy="123" rx="8" ry="12" fill="${skinDark}"/><ellipse cx="172" cy="123" rx="8" ry="12" fill="${skinDark}"/>`
        + `<path d="${faces[a.face] || faces.round}" fill="url(#${u}s)"/>`
        + `<ellipse cx="86" cy="133" rx="12" ry="6.5" fill="#ff7b8f" opacity=".34"/><ellipse cx="154" cy="133" rx="12" ry="6.5" fill="#ff7b8f" opacity=".34"/>`
        + (br ? `<path d="${br[0]} M${br[1].slice(1)}" stroke="${browC}" stroke-width="${br[2]}" fill="none" stroke-linecap="round"/>` : "")
        + `<g class="avatar-blink">${eyesMarkup(a.eyes, a.eyeColor, skin)}</g>`
        + `<path d="M118 124 Q121 133 125 130" stroke="${shade(skin, -0.28)}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`
        + `<g class="avatar-expression">${MOUTHS[a.mouth] || MOUTHS.smile}</g>`
        + beard
        + `<path d="${hair.front}" fill="url(#${u}h)"/><path d="M92 62 Q120 52 148 63" stroke="${shade(hc, 0.42)}" stroke-width="4" opacity=".42" fill="none" stroke-linecap="round"/>`
        + (a.accessory !== "catears" ? accessoryMarkup(a.accessory) : "")
        + `</g>`;
}

/** Áp dữ liệu avatar lên một <svg> (vẽ lại toàn bộ nội dung). */
export function applyAvatar(svg, data) {
    if (!svg) return;
    svg.setAttribute("viewBox", "0 0 240 240");
    svg.innerHTML = renderAvatar(sanitizeAvatar(data));
}

/** Tạo avatar ngẫu nhiên từ danh sách cho phép. */
export function randomAvatar() {
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    return Object.fromEntries(OPTIONS.map(o => [o.key, pick(o.values)[0]]));
}

/** Tạo <svg> avatar mới (dùng cho danh sách thành viên). */
export function createAvatarSvg(data, label) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", label);
    applyAvatar(svg, data);
    return svg;
}
