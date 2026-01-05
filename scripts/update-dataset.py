import kagglehub

# Download latest version
path = kagglehub.dataset_download("sakhawat18/asteroid-dataset")

print("Path to dataset files:", path)