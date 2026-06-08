package main

import (
	"log"
	"net/http"
	"os"
	"predictball_api/handlers"
	"predictball_api/services"

	"github.com/joho/godotenv"
)

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Println("Warning: No .env file found")
	}

	apiKey := os.Getenv("football_data_token")
	if apiKey == "" {
		log.Fatal("football_data_token environment variable is not set")
	}

	svc := services.NewFootballAPIService(apiKey)
	mockSvc := services.NewTemplateService()

	handler := handlers.NewAPIHandler(svc)
	mockHandler := handlers.NewAPIHandler(mockSvc)

	mux := http.NewServeMux()
	mockMux := http.NewServeMux()

	wrapperHandler := handlers.RegisterRoutes(mux, handler)
	mockWrapperHandler := handlers.RegisterRoutes(mockMux, mockHandler)

	port := ":8080"
	mockPort := ":8081"

	go func() {
		log.Printf("Starting server on port %s", mockPort)
		if err := http.ListenAndServe(mockPort, wrapperHandler); err != nil {
			log.Fatalf("Server failed to start: %v", err)
		}
	}()

	log.Printf("Starting server on port %s", port)
	if err := http.ListenAndServe(port, mockWrapperHandler); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
