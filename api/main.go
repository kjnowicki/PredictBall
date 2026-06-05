package main

import (
	"log"
	"net/http"
	"os"
	"predictball_api/handlers"
	"predictball_api/services"
)

func main() {
	apiKey := os.Getenv("football_data_token") // Or whatever it is called in your .env
	if apiKey == "" {
		log.Fatal("football_data_token environment variable is not set")
	}

	svc := services.NewTemplateService()
	h := handlers.NewAPIHandler(svc)

	mux := http.NewServeMux()
	handlers.RegisterRoutes(mux, h)

	port := ":8080"
	log.Printf("Starting server on port %s", port)
	if err := http.ListenAndServe(port, mux); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
