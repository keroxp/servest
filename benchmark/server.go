package main

import (
	"fmt"
	"github.com/apex/log"
	"net/http"
)

func main() {
	http.HandleFunc("/", func(writer http.ResponseWriter, request *http.Request) {
		writer.WriteHeader(200)
		fmt.Fprint(writer, "ok")
	})
	err := http.ListenAndServe(":4500", nil)
	if err != nil {
		log.Fatal(err.Error())
	}
}
