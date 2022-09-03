# API Endpoints
## Register User
```curl
curl --request POST \
  --url http://localhost:8080/api/register \
  --header 'Content-Type: application/json' \
  --data '{
	"email": "test@gmail.com",
	"password": "test",
	"display_name": "test",
	"preferred_earliest": "12:00", // make sure to use the same format
	"preferred_latest": "20:00", // make sure to use the same format
	"timezone": "+02:00" // make sure to use the same format
}'
```
### Response
* `Status 200` - successful (returns empty body)
* `Status 400` - missing or invalid argument
* `Status 500` - something went wrong in BE 


## Login User
### Request
```curl
curl --request POST \
  --url http://localhost:8080/api/authenticate \
  --header 'Content-Type: application/json' \
  --data '{
	"email": "test@gmail.com",
	"password": "test"
}'
```
### Response
* `Status 200` - successful (returns a set-cookie header which sets the auth token in the cookie)
* `Status 400` - missing or invalid argument
* `Status 401` - user email or password are wrong
* `Status 500` - something went wrong in BE


## Get ALl meetings (requires already logged-in User cookie)
```curl
curl --request GET \
  --url http://localhost:8080/api/meetings \
  --header 'Content-Type: application/json' \
  --cookie token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NSwiZW1haWwiOiJ0ZXN0MUBnbWFpbC5jb20iLCJkaXNwbGF5X25hbWUiOiJ0ZXN0IiwicHJlZmVycmVkX2VhcmxpZXN0IjoiMTI6MDAiLCJwcmVmZXJyZWRfbGF0ZXN0IjoiMjA6MDAiLCJ0aW1lem9uZSI6IiswIiwiaWF0IjoxNjYyMjExMTA4LCJleHAiOjE2NjIyMTQ3MDh9.v9crtVgKv2kOrm__IXCscohJ8V_9bG_KF0VEsoy6V1E \
  --data '{
}'
```
### Response
* `Status 200` - successful (returns list of meetings)
```json
[
	{
		"id": 24,
		"title": "some meeting",
		"preferred_earliest": "2022-09-02T10:33:22.434Z",
		"preferred_latest": "2022-09-02T20:33:22.434Z",
		"agreed_time": "2022-09-02T12:00:00.000Z",
		"duration_in_minutes": 30
	},
	{
		"id": 17,
		"title": "some meeting",
		"preferred_earliest": "2022-09-02T16:33:22.434Z",
		"preferred_latest": "2022-09-02T20:33:22.434Z",
		"agreed_time": "2022-09-02T16:33:22.434Z",
		"duration_in_minutes": 30
	}
]
```
### Response
* `Status 401` - user didn't login or the cookie is missing, try to login via `/api/authenticate` 
* `Status 500` - something went wrong in BE
## Create a meeting (requires a logged-in user token in cookies)


### Request
```curl
curl --request POST \
  --url http://localhost:8080/api/meeting \
  --header 'Content-Type: application/json' \
  --cookie token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NSwiZW1haWwiOiJ0ZXN0MUBnbWFpbC5jb20iLCJkaXNwbGF5X25hbWUiOiJ0ZXN0IiwicHJlZmVycmVkX2VhcmxpZXN0IjoiMTI6MDAiLCJwcmVmZXJyZWRfbGF0ZXN0IjoiMjA6MDAiLCJ0aW1lem9uZSI6IiswIiwiaWF0IjoxNjYyMjExMTA4LCJleHAiOjE2NjIyMTQ3MDh9.v9crtVgKv2kOrm__IXCscohJ8V_9bG_KF0VEsoy6V1E \
  --data '{
	"title": "some meeting",
	"preferred_earliest": "2022-09-02T10:33:22.434Z", // make sure to use the same format
	"preferred_latest":"2022-09-02T20:33:22.434Z", // make sure to use the same format
	"attendees": [6,7],
	"duration_in_minutes": 30
}'
```
### Response
* `Status 200` - successful (empty body)
* `Status 400` - missing or invalid argument
* `Status 401` - user didn't login or the cookie is missing, try to login via `/api/authenticate`
* `Status 500` - something went wrong in BE