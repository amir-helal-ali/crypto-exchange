package websocket

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	gorillaws "github.com/gorilla/websocket"
)

var upgrader = gorillaws.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type BinanceTicker struct {
	Symbol string `json:"s"`
	Price  string `json:"c"`
	High   string `json:"h"`
	Low    string `json:"l"`
	Volume string `json:"v"`
	Change string `json:"P"`
}

type StreamResponse struct {
	Stream string       `json:"stream"`
	Data   BinanceTicker `json:"data"`
}

var clients = make(map[*gorillaws.Conn]bool)
var broadcast = make(chan StreamResponse)

func init() {
	go handleBinanceConnection()
	go broadcaster()
}

func handleBinanceConnection() {
	symbols := []string{"btcusdt", "ethusdt", "solusdt", "bnbusdt", "xrpusdt", "adausdt", "dogeusdt", "dotusdt"}
	streams := ""
	for i, s := range symbols {
		if i > 0 {
			streams += "/"
		}
		streams += s + "@miniTicker"
	}

	url := "wss://stream.binance.com:9443/stream?streams=" + streams

	for {
		log.Printf("Connecting to Binance WebSocket: %s", url)
		conn, _, err := gorillaws.DefaultDialer.Dial(url, nil)
		if err != nil {
			log.Printf("Binance WS connection failed: %v. Retrying in 5s...", err)
			time.Sleep(5 * time.Second)
			continue
		}
		log.Println("Connected to Binance WebSocket successfully")

		for {
			_, message, err := conn.ReadMessage()
			if err != nil {
				log.Printf("Binance WS read error: %v. Reconnecting...", err)
				conn.Close()
				break
			}

			var response StreamResponse
			if err := json.Unmarshal(message, &response); err == nil {
				broadcast <- response
			}
		}
	}
}

func broadcaster() {
	for {
		msg := <-broadcast
		for client := range clients {
			err := client.WriteJSON(msg)
			if err != nil {
				log.Printf("WS write error: %v", err)
				client.Close()
				delete(clients, client)
			}
		}
	}
}

func HandleMarketWebSocket(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Println("WebSocket upgrade error:", err)
		return
	}
	defer conn.Close()

	clients[conn] = true
	log.Println("New client connected to market WS")

	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			delete(clients, conn)
			log.Println("Client disconnected from market WS")
			break
		}
	}
}
