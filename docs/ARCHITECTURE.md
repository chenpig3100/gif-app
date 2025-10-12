flowchart LR
  subgraph Client
    B[Web / Postman]
  end

  B -->|HTTPS| ALB[(ALB 443)]
  ALB --> API[EC2: gif-app<br/>/api, pre-signed URL, enqueue jobs]

  subgraph Async path
    S3[(S3 uploads)]
    L[(Lambda<br/>S3 ObjectCreated)]
    Q[SQS gif-jobs]
    DLQ[(SQS gif-jobs-dlq)]
    ECS[ECS Fargate Service<br/>gif-worker (1→3→1 autoscale)]
  end

  API -->|SendMessage| Q
  S3 -->|event| L -->|SendMessage| Q
  Q -->|Consume| ECS --> S3
  Q -. failed .-> DLQ

  subgraph CDN
    CF[CloudFront<br/>/uploads/*]
  end
  S3 --> CF

  subgraph IAM/Config
    SSM[(SSM Parameter Store)]
    ACM[(ACM Cert)]
    R53[(Route53 CNAME)]
  end

  R53 --> ALB
  ACM --> ALB
  SSM --> API
  SSM --> ECS