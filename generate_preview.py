import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

# 1200 x 630 Twitter Card & OpenGraph Standard Size
W, H = 1200, 630
img = Image.new('RGBA', (W, H), (12, 14, 20, 255))
draw = ImageDraw.Draw(img)

# 1. Warm Pub Wall Background with radial spotlight gradient
for y in range(H):
    for x in range(0, W, 4):
        # Spotlight centered around (W * 0.65, H * 0.45)
        dx = x - (W * 0.62)
        dy = y - (H * 0.48)
        dist = math.sqrt(dx * dx + dy * dy)
        factor = max(0.0, 1.0 - dist / 700.0)
        
        # Base dark slate / pub wall color
        r = int(14 + factor * 45)
        g = int(16 + factor * 35)
        b = int(24 + factor * 25)
        draw.rectangle([x, y, x + 4, y + 1], fill=(r, g, b, 255))

# Subtle wood floor at bottom
floor_y = int(H * 0.82)
for y in range(floor_y, H):
    progress = (y - floor_y) / (H - floor_y)
    r = int(28 + progress * 20)
    g = int(18 + progress * 12)
    b = int(12 + progress * 8)
    draw.line([(0, y), (W, y)], fill=(r, g, b, 255))
    if y % 20 == 0:
        draw.line([(0, y), (W, y)], fill=(15, 10, 6, 255), width=2)

# Oche raised red toe line mark
draw.rectangle([int(W * 0.05), int(H * 0.92), int(W * 0.45), int(H * 0.94)], fill=(160, 30, 25, 255))
draw.rectangle([int(W * 0.05), int(H * 0.92), int(W * 0.45), int(H * 0.925)], fill=(220, 180, 80, 255))

# 2. Draw Tournament Dartboard at (cx, cy)
cx, cy = int(W * 0.68), int(H * 0.46)
board_r = 210

# Velvet surround ring (Burgundy red)
draw.ellipse([cx - board_r - 45, cy - board_r - 45, cx + board_r + 45, cy + board_r + 45], fill=(139, 26, 32, 255), outline=(90, 15, 20, 255), width=4)

# Dartboard black outer edge
draw.ellipse([cx - board_r, cy - board_r, cx + board_r, cy + board_r], fill=(18, 18, 22, 255))

# Regulation sectors
sectors = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]
r_double_outer = int(board_r * 0.76)
r_double_inner = int(board_r * 0.72)
r_treble_outer = int(board_r * 0.48)
r_treble_inner = int(board_r * 0.44)
r_outer_bull = int(board_r * 0.08)
r_inner_bull = int(board_r * 0.035)

black_color = (24, 24, 28, 255)
cream_color = (232, 222, 197, 255)
red_color = (204, 28, 35, 255)
green_color = (31, 122, 58, 255)

for i in range(20):
    start_deg = -90 + (i * 18 - 9)
    end_deg = -90 + (i * 18 + 9)
    is_even = (i % 2 == 0)
    
    sec_color = black_color if is_even else cream_color
    ring_color = red_color if is_even else green_color
    
    # Outer single bed
    draw.pieslice([cx - r_double_inner, cy - r_double_inner, cx + r_double_inner, cy + r_double_inner], start_deg, end_deg, fill=sec_color)
    
    # Double ring
    draw.pieslice([cx - r_double_outer, cy - r_double_outer, cx + r_double_outer, cy + r_double_outer], start_deg, end_deg, fill=ring_color)
    draw.pieslice([cx - r_double_inner, cy - r_double_inner, cx + r_double_inner, cy + r_double_inner], start_deg, end_deg, fill=sec_color)
    
    # Treble ring
    draw.pieslice([cx - r_treble_outer, cy - r_treble_outer, cx + r_treble_outer, cy + r_treble_outer], start_deg, end_deg, fill=ring_color)
    draw.pieslice([cx - r_treble_inner, cy - r_treble_inner, cx + r_treble_inner, cy + r_treble_inner], start_deg, end_deg, fill=sec_color)

# Outer Bull (Green)
draw.ellipse([cx - r_outer_bull, cy - r_outer_bull, cx + r_outer_bull, cy + r_outer_bull], fill=green_color)
# Inner Bull (Red)
draw.ellipse([cx - r_inner_bull, cy - r_inner_bull, cx + r_inner_bull, cy + r_inner_bull], fill=red_color)

# Metallic Spider Wire Rings
wire_color = (210, 210, 225, 255)
for r in [r_double_outer, r_double_inner, r_treble_outer, r_treble_inner, r_outer_bull, r_inner_bull]:
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=wire_color, width=2)

# Radial spoke wires
for i in range(20):
    angle = math.radians(-90 + (i * 18 - 9))
    x1 = cx + math.cos(angle) * r_outer_bull
    y1 = cy + math.sin(angle) * r_outer_bull
    x2 = cx + math.cos(angle) * r_double_outer
    y2 = cy + math.sin(angle) * r_double_outer
    draw.line([(x1, y1), (x2, y2)], fill=wire_color, width=2)

# Draw Numbers around the ring
try:
    font_num = ImageFont.truetype("arialbd.ttf", 18)
    font_title = ImageFont.truetype("arialbd.ttf", 46)
    font_sub = ImageFont.truetype("arialbd.ttf", 22)
    font_board = ImageFont.truetype("arialbd.ttf", 20)
    font_large_score = ImageFont.truetype("arialbd.ttf", 64)
    font_badge = ImageFont.truetype("arialbd.ttf", 15)
except:
    font_num = ImageFont.load_default()
    font_title = font_num
    font_sub = font_num
    font_board = font_num
    font_large_score = font_num
    font_badge = font_num

num_r = int((r_double_outer + board_r) * 0.5)
for i in range(20):
    angle = math.radians(-90 + i * 18)
    nx = cx + math.cos(angle) * num_r
    ny = cy + math.sin(angle) * num_r
    s_txt = str(sectors[i])
    bbox = draw.textbbox((0, 0), s_txt, font=font_num)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text((nx - tw // 2, ny - th // 2), s_txt, fill=(240, 240, 250, 255), font=font_num)

# 3. Draw 3D Embedded Darts
# Dart 1: Treble 20 (Top red ring: 0 deg from top, r ~ (r_treble_inner + r_treble_outer)/2)
t20_y = cy - int((r_treble_inner + r_treble_outer) * 0.5)
t20_x = cx
# Dart shaft & flight angling slightly out
draw.line([(t20_x, t20_y), (t20_x + 35, t20_y - 75)], fill=(200, 200, 200, 255), width=3)
draw.polygon([(t20_x + 28, t20_y - 60), (t20_x + 48, t20_y - 72), (t20_x + 42, t20_y - 92), (t20_x + 24, t20_y - 78)], fill=(230, 57, 70, 255))
draw.polygon([(t20_x + 20, t20_y - 68), (t20_x + 38, t20_y - 88), (t20_x + 22, t20_y - 98), (t20_x + 12, t20_y - 76)], fill=(56, 189, 248, 255))

# Dart 2: Bullseye (Center)
draw.line([(cx, cy), (cx - 45, cy - 65)], fill=(210, 180, 60, 255), width=3)
draw.polygon([(cx - 38, cy - 52), (cx - 58, cy - 62), (cx - 54, cy - 82), (cx - 34, cy - 70)], fill=(255, 190, 11, 255))

# Dart 3: Treble 20 again (Close grouping!)
draw.line([(t20_x + 6, t20_y + 2), (t20_x + 55, t20_y - 65)], fill=(180, 180, 190, 255), width=3)
draw.polygon([(t20_x + 45, t20_y - 50), (t20_x + 65, t20_y - 62), (t20_x + 60, t20_y - 80), (t20_x + 40, t20_y - 68)], fill=(230, 57, 70, 255))

# 4. Chalkboard Scoreboard on Left
sb_x, sb_y = 50, 75
sb_w, sb_h = 320, 480
# Frame
draw.rectangle([sb_x - 10, sb_y - 10, sb_x + sb_w + 10, sb_y + sb_h + 10], fill=(42, 28, 14, 255), outline=(20, 12, 6, 255), width=3)
# Slate
draw.rectangle([sb_x, sb_y, sb_x + sb_w, sb_y + sb_h], fill=(16, 20, 26, 255), outline=(51, 65, 85, 255), width=2)

draw.text((sb_x + 25, sb_y + 22), "DARTS CHAMPIONSHIP", fill=(248, 250, 252, 255), font=font_board)
# Badge
draw.rectangle([sb_x + 25, sb_y + 56, sb_x + 190, sb_y + 86], fill=(230, 57, 70, 255))
draw.text((sb_x + 36, sb_y + 62), "MODE: 301 MATCH", fill=(255, 255, 255, 255), font=font_badge)

# Remaining score
draw.text((sb_x + 25, sb_y + 105), "181", fill=(56, 189, 248, 255), font=font_large_score)
draw.text((sb_x + 25, sb_y + 185), "POINTS REMAINING", fill=(148, 163, 184, 255), font=font_badge)

draw.line([(sb_x + 20, sb_y + 215), (sb_x + sb_w - 20, sb_y + 215)], fill=(30, 41, 59, 255), width=2)

# Darts Thrown
draw.text((sb_x + 25, sb_y + 230), "CURRENT ROUND:", fill=(241, 245, 249, 255), font=font_board)
draw.text((sb_x + 25, sb_y + 265), "• Dart 1: Treble 20 (60)", fill=(74, 222, 128, 255), font=font_board)
draw.text((sb_x + 25, sb_y + 295), "• Dart 2: Treble 20 (60)", fill=(74, 222, 128, 255), font=font_board)
draw.text((sb_x + 25, sb_y + 325), "• Dart 3: BULLSEYE (50)", fill=(251, 191, 36, 255), font=font_board)

# Banner Callout
draw.rectangle([sb_x + 20, sb_y + 365, sb_x + sb_w - 20, sb_y + 415], fill=(220, 38, 38, 255))
draw.text((sb_x + 45, sb_y + 378), "★ TURN SCORE: 170! ★", fill=(255, 255, 255, 255), font=font_board)

draw.text((sb_x + 25, sb_y + 438), "Avg: 85.0  •  High Turn: 170", fill=(148, 163, 184, 255), font=font_badge)

# 5. High-Impact Main Title & Badges in Top Center/Right
title_x = 410
draw.text((title_x, 38), "🎯 VR & 3D DARTS", fill=(255, 255, 255, 255), font=font_title)
draw.text((title_x, 94), "Regulation PDC Tournament • Play Anywhere in Browser", fill=(56, 189, 248, 255), font=font_sub)

# Badges
badges = [
    ("🥽 Meta Quest & WebXR VR Ready", (14, 116, 144, 255)),
    ("🖥️ 3D Desktop Mouse & Touch", (30, 41, 59, 255)),
    ("⚡ Instant Browser Play • Zero Install", (20, 83, 45, 255)),
    ("📱 X / Twitter Card Player Ready", (88, 28, 135, 255))
]

bx, by = title_x, 140
for b_txt, b_bg in badges:
    b_len = len(b_txt) * 9 + 30
    draw.rectangle([bx, by, bx + b_len, by + 34], fill=b_bg, outline=(255, 255, 255, 80), width=1)
    draw.text((bx + 14, by + 8), b_txt, fill=(255, 255, 255, 255), font=font_badge)
    by += 44

# Save final 1200x630 preview image
img.save("preview.png", "PNG")
print("Successfully generated preview.png (1200x630)")
