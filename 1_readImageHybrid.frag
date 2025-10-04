// Author: CMH (edited to 5x5 by ChatGPT for Peipei)
// Title: Hybrid Image with Aspect Ratio Fix (5x5 filters)

#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;
uniform sampler2D u_tex0; // high pass source
uniform sampler2D u_tex1; // low pass source

void main() {
    // --- Step 1. Base coordinate ---
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;

    // --- Step 2. Keep correct aspect ratio (no stretching) ---
    float canvasAspect = u_resolution.x / u_resolution.y;
    float imageAspect = 1.0; // 若你的圖片非正方，請改成正確比例 (w/h)

    vec2 scale = vec2(1.0);
    if (canvasAspect > imageAspect) {
        scale.x = imageAspect / canvasAspect;
    } else {
        scale.y = canvasAspect / imageAspect;
    }
    uv = (uv - 0.5) / scale + 0.5;

    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        gl_FragColor = vec4(0.0);
        return;
    }

    // --- Step 3. Filters (upgraded to 5x5) ---
    vec2 texel = 1.0 / u_resolution.xy;
    vec2 mouse = u_mouse.xy / u_resolution.xy;

    // =========================
    // 5x5 Gaussian (two scales)
    // =========================
    // 小核：Pascal 5-tap (1,4,6,4,1) 外積，總和=256
    float kernelSmall[25];
    // row-major from y=-2..2, x=-2..2
    kernelSmall[ 0]= 1.0/256.0; kernelSmall[ 1]= 4.0/256.0; kernelSmall[ 2]= 6.0/256.0; kernelSmall[ 3]= 4.0/256.0; kernelSmall[ 4]= 1.0/256.0;
    kernelSmall[ 5]= 4.0/256.0; kernelSmall[ 6]=16.0/256.0; kernelSmall[ 7]=24.0/256.0; kernelSmall[ 8]=16.0/256.0; kernelSmall[ 9]= 4.0/256.0;
    kernelSmall[10]= 6.0/256.0; kernelSmall[11]=24.0/256.0; kernelSmall[12]=36.0/256.0; kernelSmall[13]=24.0/256.0; kernelSmall[14]= 6.0/256.0;
    kernelSmall[15]= 4.0/256.0; kernelSmall[16]=16.0/256.0; kernelSmall[17]=24.0/256.0; kernelSmall[18]=16.0/256.0; kernelSmall[19]= 4.0/256.0;
    kernelSmall[20]= 1.0/256.0; kernelSmall[21]= 4.0/256.0; kernelSmall[22]= 6.0/256.0; kernelSmall[23]= 4.0/256.0; kernelSmall[24]= 1.0/256.0;

    // 大核：近似更大 sigma（1,6,12,6,1）外積，總和=26*26=676
    float kernelLarge[25];
    kernelLarge[ 0]=  1.0/676.0; kernelLarge[ 1]=  6.0/676.0; kernelLarge[ 2]= 12.0/676.0; kernelLarge[ 3]=  6.0/676.0; kernelLarge[ 4]=  1.0/676.0;
    kernelLarge[ 5]=  6.0/676.0; kernelLarge[ 6]= 36.0/676.0; kernelLarge[ 7]= 72.0/676.0; kernelLarge[ 8]= 36.0/676.0; kernelLarge[ 9]=  6.0/676.0;
    kernelLarge[10]= 12.0/676.0; kernelLarge[11]= 72.0/676.0; kernelLarge[12]=144.0/676.0; kernelLarge[13]= 72.0/676.0; kernelLarge[14]= 12.0/676.0;
    kernelLarge[15]=  6.0/676.0; kernelLarge[16]= 36.0/676.0; kernelLarge[17]= 72.0/676.0; kernelLarge[18]= 36.0/676.0; kernelLarge[19]=  6.0/676.0;
    kernelLarge[20]=  1.0/676.0; kernelLarge[21]=  6.0/676.0; kernelLarge[22]= 12.0/676.0; kernelLarge[23]=  6.0/676.0; kernelLarge[24]=  1.0/676.0;

    // 5x5 取樣偏移（-2..2）
    vec2 offset[25];
    offset[ 0]=vec2(-2.0,-2.0); offset[ 1]=vec2(-1.0,-2.0); offset[ 2]=vec2( 0.0,-2.0); offset[ 3]=vec2( 1.0,-2.0); offset[ 4]=vec2( 2.0,-2.0);
    offset[ 5]=vec2(-2.0,-1.0); offset[ 6]=vec2(-1.0,-1.0); offset[ 7]=vec2( 0.0,-1.0); offset[ 8]=vec2( 1.0,-1.0); offset[ 9]=vec2( 2.0,-1.0);
    offset[10]=vec2(-2.0, 0.0); offset[11]=vec2(-1.0, 0.0); offset[12]=vec2( 0.0, 0.0); offset[13]=vec2( 1.0, 0.0); offset[14]=vec2( 2.0, 0.0);
    offset[15]=vec2(-2.0, 1.0); offset[16]=vec2(-1.0, 1.0); offset[17]=vec2( 0.0, 1.0); offset[18]=vec2( 1.0, 1.0); offset[19]=vec2( 2.0, 1.0);
    offset[20]=vec2(-2.0, 2.0); offset[21]=vec2(-1.0, 2.0); offset[22]=vec2( 0.0, 2.0); offset[23]=vec2( 1.0, 2.0); offset[24]=vec2( 2.0, 2.0);

    // -------- Low pass (5x5, dual-scale) --------
    float lpScaleSmall = 10.0; // 先從 2.0 開始；想更糊可調到 3.0
    float lpScaleLarge = 20.0; // 想更糊可 7.0~9.0

    vec3 blurSmall = vec3(0.0);
    vec3 blurLarge = vec3(0.0);
    for (int i = 0; i < 25; i++) {
        vec2 sampleUVs = uv + offset[i] * texel * lpScaleSmall;
        vec2 sampleUVl = uv + offset[i] * texel * lpScaleLarge;
        blurSmall += texture2D(u_tex1, sampleUVs).rgb * kernelSmall[i];
        blurLarge += texture2D(u_tex1, sampleUVl).rgb * kernelLarge[i];
    }
    vec3 lowpass = 0.5 * blurSmall + 0.5 * blurLarge;

    // -------- High pass (5x5 Laplacian) --------
    // 24 個周邊取樣權重 -1，中心 +24；再乘上 strength
    float strength = 0.2;
    float kernelHP[25];
    for (int i = 0; i < 25; i++) kernelHP[i] = -1.0 * strength;
    kernelHP[12] = 24.0 * strength; // (row 2, col 2) 中心

    vec3 highpass = vec3(0.0);
    for (int i = 0; i < 25; i++) {
        vec2 sampleUV = uv + offset[i] * texel;
        highpass += texture2D(u_tex0, sampleUV).rgb * kernelHP[i];
    }

    // --- Blend ---
    float lowpassWeight  = 1.0 - 0.5 * mouse.y;
    float highpassWeight = 0.5 + mouse.y;
    vec3 hybrid = lowpass * lowpassWeight + highpass * highpassWeight;

    gl_FragColor = vec4(hybrid, 1.0);
}
