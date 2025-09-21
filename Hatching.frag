// Author: CMH
// Title: Learning Shaders


#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;
uniform sampler2D u_tex0; //Pian.mp4
uniform sampler2D u_tex1;
uniform sampler2D u_tex2;
uniform sampler2D u_tex3;
uniform sampler2D u_tex4;
uniform sampler2D u_tex5;
uniform sampler2D u_tex6;

vec2 fitContainUV(vec2 frag, vec2 screen, vec2 texSize) {
    float s = min(screen.x / texSize.x, screen.y / texSize.y);
    vec2 size   = texSize * s;           // 縮放後尺寸
    vec2 offset = (screen - size) * 0.5; // 置中偏移
    return (frag - offset) / size;       // 轉為 0..1 貼圖座標
}
void main()
{
    const vec2 TEX0_SIZE = vec2(1152.0, 768.0); // 例：1152x768；不確定就填你的實際圖尺寸

    vec2 uv  = fitContainUV(gl_FragCoord.xy, u_resolution, TEX0_SIZE);
    vec2 vUv = fract(6.0 * clamp(uv, 0.0, 1.0)); // 防止邊界 wrap
    float shading = texture2D(u_tex0, clamp(uv, 0.0, 1.0)).g;


    vec4 c;
                float step = 1. / 6.;
                if( shading <= step ){   
                    c = mix( texture2D( u_tex6, vUv ), texture2D( u_tex5, vUv ), 6. * shading );
                }
                if( shading > step && shading <= 2. * step ){
                    c = mix( texture2D( u_tex5, vUv ), texture2D( u_tex4, vUv) , 6. * ( shading - step ) );
                }
                if( shading > 2. * step && shading <= 3. * step ){
                    c = mix( texture2D( u_tex4, vUv ), texture2D( u_tex3, vUv ), 6. * ( shading - 2. * step ) );
                }
                if( shading > 3. * step && shading <= 4. * step ){
                    c = mix( texture2D( u_tex3, vUv ), texture2D( u_tex2, vUv ), 6. * ( shading - 3. * step ) );
                }
                if( shading > 4. * step && shading <= 5. * step ){
                    c = mix( texture2D( u_tex2, vUv ), texture2D( u_tex1, vUv ), 6. * ( shading - 4. * step ) );
                }
                if( shading > 5. * step ){
                    c = mix( texture2D( u_tex1, vUv ), vec4( 1. ), 6. * ( shading - 5. * step ) );
                }
                
     vec4 inkColor = vec4(0.0, 0.0, 1.0, 1.0);
     vec4 src = mix( mix( inkColor, vec4( 1. ), c.r ), c, .5 );
     gl_FragColor = src;


    

}

