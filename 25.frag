// Evolved Line-Art Fragment Shader
// Inspired by: Artificial Evolution for Computer Graphics (Karl Sims)
// Implements: Fixed Genotype (Line), Brightness-Based Four-Color Palette

#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;

#define iTime       u_time
#define iResolution u_resolution
#define iMouse      u_mouse
#define fragCoord   gl_FragCoord.xy

uniform sampler2D u_tex0;       // data/photo4.png
uniform sampler2D u_tex1;       // data/photo3.png
uniform sampler2D u_buffer0;    // FBO from previous iterated frame

// --- CONFIGURATION ---
#define NUM_GENOTYPE_PARAMS 18.0
#define EXPLORATION_TIME 30.0   // 探索期
#define SHAPE_TYPE 2            // 2: Line

// --- FOUR-COLOR PALETTE ---
// 可以自由微調這四個顏色
#define COLOR_LIGHT vec4(1.0,   0.9,    0.7,    1.0)   // 亮色調 (米白偏黃)
#define COLOR_MID   vec4(0.349, 0.5059, 0.6627, 1.0)   // 中色調 (藍灰)
#define COLOR_DARK  vec4(0.3098, 0.1882, 0.2235, 1.0)   // 暗色調 (深紫)
#define COLOR_DEEP  vec4(0.0941, 0.0745, 0.2078, 1.0)   // 最暗色調 (接近黑的冷紫)

//==============================================================
// PASS A: EVOLUTION LOGIC (BUFFER_0)
//==============================================================
#if defined(BUFFER_0)

// --- UTILITY FUNCTIONS ---

float Random_Final(vec2 uv, float seed)
{
    float fixedSeed = abs(seed) + 1.0;
    float x = dot(uv, vec2(12.9898,78.233) * fixedSeed);
    return fract(sin(x) * 43758.5453);
}

// 越靠中心 → 1，越靠邊 → 0
float borderFactor(vec2 uv)
{
    float edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
    return smoothstep(0.02, 0.10, edge);
}

// 判斷 testPoint 是否在線段附近
bool pointInLine(vec2 p1, vec2 p2, float width, vec2 testPoint)
{
    float len = length(p2 - p1);
    vec2 dir = (p2 - p1) / len;
    float t = clamp(dot(testPoint - p1, dir), 0.0, len);
    vec2 proj = p1 + dir * t;
    return length(testPoint - proj) < width;
}

// --- MAIN EVOLUTION LOOP ---
void main()
{
    vec2 imageUV = fragCoord / iResolution;
    vec2 testUV  = vec2(1.0, 1.0);

    float border = borderFactor(imageUV);

    // 1. TARGET SELECTION（其實只用來取亮度）
    vec4 targetColor;
    float targetSelect = step(0.5, sin(iTime / EXPLORATION_TIME));
    if (targetSelect > 0.5) {
        targetColor = texture2D(u_tex1, imageUV);
    } else {
        targetColor = texture2D(u_tex1, imageUV);
    }

    vec4 prevColor = texture2D(u_buffer0, imageUV);

    // 初始 buffer 為黑時，改成白色底
    if (prevColor.a == 0.0 && prevColor.rgb == vec3(0.0)) {
        prevColor = vec4(1.0);
    }

    // 先從前一幀的顏色開始累積
    gl_FragColor = prevColor;

    // --- 線條密度控制：這裡你已經設成 1.0，就是每幀都畫 ---
    float density = mix(1.0, 1.0, border);
    float rnd = Random_Final(imageUV, iTime * 31.0);
    if (rnd > density) {
        return; // 這一幀這個 pixel 不畫線
    }

    // ===============================
    // ★ 倍數加速：同一個像素每幀畫 N 條線
    //    想更快就改 6 → 8、10...
    // ===============================
    const int STROKE_COUNT = 6;   // ← 這就是倍數，6 代表 6 倍量
    for (int i = 0; i < STROKE_COUNT; i++) {

        // 2. GENOTYPE：線段參數

        // 線段中心點（加上 i 讓每條線 seed 不同）
        vec2 centerPoint = vec2(
            Random_Final(testUV, iTime + float(i) * 10.0),
            Random_Final(testUV, iTime * 2.0 + float(i) * 13.0)
        );

        // 線長（保留你原本的設定，只是 seed 略微偏移）
        float lineLength = Random_Final(testUV, iTime * 3.0 + float(i) * 17.0) * 0.4 + 0.05;
        lineLength *= mix(0.4, 1.0, border);  // 邊緣略短

        // 線角度
        float lineAngle = Random_Final(testUV, iTime * 4.0 + float(i) * 19.0) * 6.28318;

        // 線寬
        float lineWidth = Random_Final(testUV, iTime * 5.0 + float(i) * 23.0) * 0.0030 + 0.0005;
        lineWidth *= mix(0.5, 1.0, border);   // 邊緣略細

        // 終點
        vec2 p2 = centerPoint + vec2(cos(lineAngle), sin(lineAngle)) * lineLength;

        // 3. 為整條線決定一個顏色（per-stroke color）
        vec4 centerSample = texture2D(u_tex1, centerPoint);
        float L = dot(centerSample.rgb, vec3(0.299, 0.587, 0.114)); // 亮度

        vec4 strokeColor;
        if (L > 0.65) {
            strokeColor = COLOR_LIGHT;   // 最亮
        } else if (L > 0.30) {
            strokeColor = COLOR_MID;     // 中間
        } else if (L > 0.05) {
            strokeColor = COLOR_DARK;    // 暗
        } else {
            strokeColor = COLOR_DEEP;    // 最暗（接近黑）
        }

        // 透明度：保留你原本的設定
        float alphaBase = 0.05 + Random_Final(testUV, iTime * 100.0 + float(i) * 7.0) * 0.20; // 0.05~0.25
        strokeColor.a = alphaBase * mix(0.8, 1.0, border);

        // 4. 是否在線上
        bool isInShape = pointInLine(centerPoint, p2, lineWidth, imageUV);

        // 5. 疊色：像在原本顏料上乾刷一筆
        if (isInShape)
        {
            gl_FragColor = mix(gl_FragColor, strokeColor, strokeColor.a);
        }
    }
}

 //==============================================================
 // MAIN PASS: DISPLAY
 //==============================================================
//==============================================================
// MAIN PASS: DISPLAY
//==============================================================
#else

void main()
{
    vec2 uv = fragCoord / iResolution;
    vec2 mouse = iMouse.xy / iResolution.xy;

    // 原始影像
    vec4 base    = texture2D(u_tex1, uv);
    // 演化出的線條層
    vec4 strokes = texture2D(u_buffer0, uv);

    // ---- 1. 暗角（vignette）----
    vec2 p = uv - 0.5;
    float ar = iResolution.x / iResolution.y;
    p.x *= ar;

    float r = length(p);
    float vignette = smoothstep(0.8, 0.35, r);

    // ---- 2. 髒邊 & 垂直水痕 ----
    float stripe = smoothstep(0.3, 0.0, abs(sin(uv.x * 40.0 + uv.y * 200.0)));
    stripe *= smoothstep(0.2, 0.0, uv.y);

    float noise = fract(sin(dot(uv * iResolution.xy, vec2(12.9898,78.233))) * 43758.5453);
    float grunge = clamp(vignette * 0.8 + stripe * 0.4 * noise, 0.0, 1.0);

    // ---- 3. 舊畫布底 ----
    vec3 baseDesat = mix(vec3(dot(base.rgb, vec3(0.3, 0.59, 0.11))), base.rgb, 0.4);
    vec3 baseDark  = baseDesat * (0.25 + 0.75 * (1.0 - grunge));

    // ---- 4. 線條覆蓋 ----
    vec3 strokeLayer = strokes.rgb;
    vec3 stylized    = mix(baseDark, strokeLayer, 0.75); // 風格化結果

    vec4 stylizedColor = vec4(stylized, 1.0);
    vec4 originalColor = texture2D(u_tex0, uv);

    // ---- 5. 滑鼠互動：游標左邊顯示原圖，右邊顯示風格化畫面 ----
    // step(uv.x, mouse.x)：
    //   uv.x < mouse.x → 1.0
    //   uv.x > mouse.x → 0.0
    float mask = step(uv.x, mouse.x);

    // mask 越大 → 原圖比例越高
    gl_FragColor = mix(stylizedColor, originalColor, mask);
}

#endif

