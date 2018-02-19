load('api_config.js');
load('api_events.js');
load('api_gpio.js');
load('api_mqtt.js');
load('api_net.js');
load('api_sys.js');
load('api_timer.js');
load('api_arduino_ssd1306.js');
load('api_i2c.js');
load('api_esp8266.js');

let led = Cfg.get('pins.led');
// Setup built-in LED for OUTPUT
GPIO.set_mode(led, GPIO.MODE_OUTPUT);

let button = Cfg.get('pins.button');

// Topics for MQTT
let topic = '/devices/' + Cfg.get('device.id') + '/events';
let envTopic = '/devices/' + Cfg.get('device.id') + '/envInfo';
let ledTopic = '/devices/' + Cfg.get('device.id') + '/ledInfo';

// Variabls for topics subscriptions
let obj;
let temperature = "0...";
let humidity = "0...";

// Variables for RGB led
let ledColor;
let ledState;

// RGB LED pin setup 
let blue = 4;
let red = 5;
let green = 0;
// Setup pins for OUTPUT
GPIO.set_mode(blue, GPIO.MODE_OUTPUT);
GPIO.set_mode(red, GPIO.MODE_OUTPUT);
GPIO.set_mode(green, GPIO.MODE_OUTPUT);
// Default when booted is off for all colors
GPIO.write(blue, 0);
GPIO.write(red, 0);
GPIO.write(green, 0);
// Set RGB colors on or off
let toggleColor = function(ledColor, ledState) {
  GPIO.write(ledColor, ledState);
};

// LCD Setup
let lcdPin = 5;
// Initialize Adafruit_SSD1306 library (I2C)
let d = Adafruit_SSD1306.create_i2c(lcdPin /* RST GPIO */, Adafruit_SSD1306.RES_128_32);
// Initialize the display.
d.begin(Adafruit_SSD1306.SWITCHCAPVCC, 0x3C, true /* reset */);
d.display();
// Various functions to show data on the Display
let showSplash = function(d, str) {
  d.clearDisplay();
  d.setTextSize(2);
  d.setTextColor(Adafruit_SSD1306.WHITE);
  d.setTextWrap(false);
  d.setCursor(0,0);
  d.write(str);
  d.setTextSize(1);
  d.setCursor(0, d.height() / 2);
  d.write("...");
  d.display();
};

let showNetBoot = function(d, str) {
  d.clearDisplay();
  d.setTextSize(1);
  d.setTextColor(Adafruit_SSD1306.WHITE);
  d.setTextWrap(true);
  d.setCursor(0,0);
  d.write(str);
  d.display();
};

let showStr = function(d, str) {
  //d.clearDisplay();
  d.setTextSize(1);
  d.setTextColor(Adafruit_SSD1306.WHITE);
  d.setTextWrap(false);
  d.setCursor(0,0);
  d.write(str);
  d.display();
};

let showTime = function(d, str) {
  d.clearDisplay();
  d.setTextColor(Adafruit_SSD1306.WHITE);
  d.setTextWrap(false);
  let ap = JSON.stringify(str).slice(27,29);
  let dmd = JSON.stringify(str).slice(1,18);
  let t = JSON.stringify(str).slice(19,24);
  
  d.setTextSize(1);
  d.setCursor(0,0);
  d.write(dmd);
  d.setTextSize(2);
  d.setCursor(d.width() / 4, d.height() / 2 );
  d.write(t)
  d.setTextSize(1);
  d.setCursor(94, d.height() / 2 );
  d.write(ap);
  d.display();
};

let showTemp = function(d, str) {
  d.clearDisplay();
  d.setTextSize(2);
  d.setTextColor(Adafruit_SSD1306.WHITE);
  d.setTextWrap(false);
  d.setCursor(d.width() /4  , d.height() / 2 );
  let temp = str;
  let info = "Temperature";
  d.write(temp);
  d.setTextSize(1);
  d.setCursor(0, 0);
  d.write(info);
  d.setCursor(84, d.height() / 2);
  d.write(chr(247));
  d.display();
};

let showHumidity = function(d, str) {
  d.clearDisplay();
  d.setTextSize(2);
  d.setTextColor(Adafruit_SSD1306.WHITE);
  d.setTextWrap(false);
  d.setCursor(d.width() /4  , d.height() / 2 );
  let hum = str;
  let info = "Humidity";
  d.write(hum);
  d.setTextSize(1);
  d.setCursor(0, 0);
  d.write(info);
  d.setCursor(84, d.height() / 2);
  d.write("%");
  d.display();
};

// Start showing data
showSplash(d, "booting");
print('LED GPIO:', led, 'button GPIO:', button);

// Subscribe to topics
MQTT.sub(envTopic, function(conn, envTopic, msg) {
  print('Topic: ', envTopic, 'message: ', msg);
  
  // blink the internal led when data is gathered
  Timer.set(200, 0, function () {GPIO.write(led, 1)}, GPIO.write(led, 0));

  obj = JSON.parse(msg);
  temperature = obj.temp;
  humidity = obj.humidity;
  
  toggleColor(red, true);
  
  if (temperature > 67 && temperature < 81) {
    toggleColor(blue, false);
    toggleColor(red, false);
    toggleColor(green, true);
  } else if (temperature < 68) {
    toggleColor(green, false);
    toggleColor(red, false);
    toggleColor(blue, true);
  } 
  
  if (JSON.stringify(humidity).length < 3) {
    humidity = humidity + 0.001;
  }
  if (JSON.stringify(temperature).length < 3) {
    temperature = temperature + 0.001;
  }
  
  temperature = JSON.stringify(temperature).slice(0,4);
  humidity = JSON.stringify(humidity).slice(0,4);
  
}, null);

MQTT.sub(ledTopic, function(conn, ledTopic, msg) {
    print('Topic: ', ledTopic, 'message: ', msg);
    
    obj = JSON.parse(msg);
    ledColor = obj.ledColor;
    ledState = obj.ledState;
    toggleColor(ledColor, ledState);
    
}, null);

// Set timers to scroll through Time, Temp, Hum on the display
Timer.set(16000, Timer.REPEAT, function() {

  let now = Timer.now() - 25200;
  let s = Timer.fmt("%a, %b %d, %Y %I:%M:%S%p", now);

  showTime(d, s);  
  
  Timer.set(5000, 0, function() {
    showTemp(d, temperature);
  }, null);

  Timer.set(10000, 0, function() {
    showHumidity(d, humidity);
  }, null);
 
}, null);

// Publish to MQTT topic on a button press. Button is wired to GPIO pin 0
//GPIO.set_button_handler(button, GPIO.PULL_UP, GPIO.INT_EDGE_NEG, 200, function() {
//  let message = getInfo();
//  MQTT.p
//  let ok = MQTT.pub(topic, message, 1);
//  print('Published:', ok, topic, '->', message);
//}, null);

// Monitor network connectivity.
Event.addGroupHandler(Net.EVENT_GRP, function(ev, evdata, arg) {
  let evs = '???';
  if (ev === Net.STATUS_DISCONNECTED) {
    evs = 'DISCONNECTED';
  } else if (ev === Net.STATUS_CONNECTING) {
    evs = 'CONNECTING';
  } else if (ev === Net.STATUS_CONNECTED) {
    evs = 'CONNECTED';
  } else if (ev === Net.STATUS_GOT_IP) {
    evs = 'GOT_IP';
  }
  showNetBoot(d, evs);
  print('== Net event:', ev, evs);
}, null);
